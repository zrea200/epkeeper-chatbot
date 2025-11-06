# 多阶段构建 Dockerfile
# 阶段 1: 构建阶段
FROM node:20-alpine AS builder

# 设置工作目录
WORKDIR /app

# 使用国内镜像源加速（解决网络超时问题）
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk update && \
    apk add --no-cache curl && \
    echo "正在下载 pnpm..." && \
    curl -fsSL https://github.com/pnpm/pnpm/releases/download/v10.4.1/pnpm-linuxstatic-x64 -o /usr/local/bin/pnpm && \
    chmod +x /usr/local/bin/pnpm && \
    pnpm --version && \
    echo "pnpm 安装完成"

# 配置 pnpm 使用官方 npm 源（容器网络问题导致国内镜像不可用）
RUN pnpm config set registry https://registry.npmjs.org/ && \
    pnpm config set fetch-retries 5 && \
    pnpm config set fetch-retry-mintimeout 30000 && \
    pnpm config set fetch-retry-maxtimeout 180000 && \
    pnpm config set network-concurrency 8

# 复制 package.json 和 lockfile
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# 安装依赖（使用 BuildKit 缓存挂载和并发优化）
# 使用 --mount=type=cache 缓存 pnpm store，大幅加速后续构建
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    echo "开始安装依赖，这可能需要几分钟..." && \
    pnpm install --frozen-lockfile --network-concurrency 16 --reporter=append-only && \
    echo "依赖安装完成"

# 复制源代码
COPY . .

# 构建应用（前端 + 后端）
RUN pnpm run build

# 阶段 2: 生产运行阶段
FROM node:20-alpine AS runner

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 复制构建产物和依赖（直接复制 node_modules，避免重新安装）
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 创建非 root 用户运行应用
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser && \
    chown -R appuser:nodejs /app

# 切换到非 root 用户
USER appuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "dist/index.js"]

