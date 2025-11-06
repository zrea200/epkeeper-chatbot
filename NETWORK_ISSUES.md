# 🌐 Docker 网络问题解决方案

## ❌ 常见错误

```bash
WARNING: fetching https://dl-cdn.alpinelinux.org/alpine/v3.22/main: operation timed out
ERROR: unable to select packages
```

---

## ✅ 解决方案（按推荐顺序）

### 方案1️⃣：使用国内镜像源（推荐，已自动配置）

**Dockerfile 已自动配置阿里云镜像源**，直接构建即可：

```bash
docker compose up -d --build
```

**原理：**
```dockerfile
# Dockerfile 中已添加：
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories
```

这会自动替换 Alpine Linux 的官方源为阿里云镜像源。

---

### 方案2️⃣：使用 Host 网络模式构建

如果方案1还有问题，启用 host 网络模式：

**步骤1：** 编辑 `docker-compose.yml`，取消注释这两行：

```yaml
services:
  epkeeper-chatbot:
    build:
      context: .
      dockerfile: Dockerfile
      network: host  # 取消注释这行
```

**步骤2：** 构建部署

```bash
docker compose up -d --build
```

---

### 方案3️⃣：使用 Docker 命令 + Host 网络

不修改配置文件，直接用命令：

```bash
# 1. 使用 host 网络构建镜像
docker build --network=host -t epkeeper-chatbot .

# 2. 启动容器
docker compose up -d
```

---

### 方案4️⃣：配置 Docker 使用代理（高级）

如果您有代理服务器：

```bash
# 临时使用代理构建
docker build \
  --build-arg HTTP_PROXY=http://your-proxy:port \
  --build-arg HTTPS_PROXY=http://your-proxy:port \
  -t epkeeper-chatbot .
```

---

## 🎯 推荐的命令流程

### 正常情况（方案1，最快）

```bash
# 一条命令搞定
docker compose up -d --build
```

### 网络问题时（方案3，使用 host 网络）

```bash
# 两步走
docker build --network=host -t epkeeper-chatbot .
docker compose up -d
```

---

## 🔍 验证网络连接

### 测试 Alpine 镜像源

```bash
docker run --rm node:20-alpine sh -c "apk update"
```

**成功输出：**
```
fetch https://dl-cdn.alpinelinux.org/alpine/v3.22/main/x86_64/APKINDEX.tar.gz
OK: 23 MiB in 53 packages
```

**失败输出：**
```
WARNING: operation timed out
ERROR: unable to fetch packages
```

### 测试网络连接

```bash
# 测试能否访问 GitHub
curl -I https://github.com

# 测试能否访问 npm registry
curl -I https://registry.npmjs.org/

# 测试能否访问阿里云镜像
curl -I https://mirrors.aliyun.com/
```

---

## 📊 方案对比

| 方案 | 速度 | 稳定性 | 修改配置 | 推荐指数 |
|-----|------|--------|---------|---------|
| 国内镜像源 | ⚡⚡⚡⚡⚡ | ⭐⭐⭐⭐⭐ | ✅ 已配置 | ⭐⭐⭐⭐⭐ |
| Host 网络 | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 需修改 | ⭐⭐⭐⭐ |
| Docker 命令 + Host | ⚡⚡⚡⚡ | ⭐⭐⭐⭐ | 不需要 | ⭐⭐⭐⭐ |
| 代理服务器 | ⚡⚡⚡ | ⭐⭐⭐ | 需配置 | ⭐⭐⭐ |

---

## 🚀 快速解决（复制粘贴即用）

### 如果遇到网络超时，执行这个：

```bash
cd /home/zrea/epkeeper-chatbot

# 使用 host 网络构建
docker build --network=host -t epkeeper-chatbot .

# 启动服务
docker compose up -d

# 查看日志确认成功
docker compose logs -f
```

---

## 💡 其他技巧

### 增加构建超时时间

```bash
# 如果网络慢但不是超时，可以增加超时时间
export DOCKER_CLIENT_TIMEOUT=300
export COMPOSE_HTTP_TIMEOUT=300

docker compose up -d --build
```

### 清理并重试

```bash
# 清理构建缓存
docker builder prune -a -f

# 重新构建
docker compose up -d --build
```

### 查看详细构建日志

```bash
# 查看详细的构建过程
docker compose build --progress=plain
```

---

## ❓ 常见问题

**Q: 为什么会网络超时？**

A: 可能的原因：
- Docker 容器默认网络受限
- 防火墙限制
- DNS 解析问题
- 服务器在国内访问国外源慢

**Q: host 网络模式安全吗？**

A: 
- ✅ 构建时使用 host 网络是安全的
- ⚠️ 运行时不建议使用 host 网络（会暴露所有端口）
- 我们的方案只在构建时使用 host 网络

**Q: 修改镜像源后还是慢？**

A: 可能是 pnpm 下载依赖慢，可以考虑：
```bash
# 使用国内 npm 镜像
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t epkeeper-chatbot .
```

---

## 📝 总结

**优先尝试（Dockerfile 已配置）：**
```bash
docker compose up -d --build
```

**如果还有问题：**
```bash
docker build --network=host -t epkeeper-chatbot .
docker compose up -d
```

这两个命令可以解决 99% 的网络问题！🎉

