# 🎯 快速开始指南

## 🤔 开发 vs 部署？看这里！

### 开发环境（本地开发，热重载 ⚡）

**用于：** 日常开发、修改代码、调试

```bash
# 一条命令启动开发服务器
./dev.sh

# 或者手动启动
pnpm install  # 首次运行
pnpm run dev  # 启动开发服务器
```

**特点：**
- ⚡ 修改代码 → 保存 → **自动刷新**（秒级）
- 🚫 **无需打包**
- 🚫 **无需 Docker**
- 🚫 **无需重启**

**访问：** http://localhost:5173

---

### 生产部署（服务器部署，打包发布 📦）

**用于：** 部署到服务器、生产环境

```bash
# 方案1：直接部署（如果网络正常）
docker compose up -d --build

# 方案2：解决网络超时（推荐）
docker build --network=host -t epkeeper-chatbot .
docker compose up -d
```

**特点：**
- 📦 打包成 Docker 镜像
- 🐌 需要 5-10 分钟构建
- 🔒 稳定、安全
- 🌐 可能遇到网络超时

**访问：** http://localhost:51872

---

## 🎯 您应该用哪个？

| 场景 | 用什么 | 命令 |
|-----|--------|------|
| 修改代码、调试 | 开发环境 | `./dev.sh` 或 `pnpm run dev` |
| 部署到服务器 | Docker | `docker build --network=host -t epkeeper-chatbot .` |
| 测试生产环境 | Docker | `docker compose up -d --build` |

---

## ⚡ 快速命令

### 开发（最常用）

```bash
# 启动开发服务器（支持热重载）
./dev.sh

# 或者
pnpm run dev
```

### 部署

```bash
# 使用 host 网络解决超时问题
docker build --network=host -t epkeeper-chatbot .
docker compose up -d

# 查看日志
docker compose logs -f
```

---

## 🔧 您遇到的问题解答

### Q: 为什么每次都要重新打包？

**A:** 因为您用错了环境！

- ❌ **错误**：开发时用 `docker compose build`（每次5-10分钟）
- ✅ **正确**：开发时用 `pnpm run dev`（修改自动刷新）

### Q: 为什么这么慢？

**A:** 
1. **网络超时**：Alpine/npm 源在国内慢
   - 解决：用 `--network=host` 参数
2. **用错环境**：开发不应该用 Docker
   - 解决：用 `pnpm run dev` 本地运行

### Q: 什么是热重载？

**A:** 
- 修改代码 → 保存文件 → 浏览器**自动刷新**
- **无需重启**、**无需打包**
- 开发效率提升 100 倍！

### Q: Volume 挂载是什么？

**A:** 
- 把本地代码目录挂载到 Docker 容器
- 修改本地代码，容器内**自动同步**
- 但开发环境不需要 Docker，直接本地运行更快！

---

## 📝 完整工作流

### 日常开发流程

```bash
# 1. 启动开发服务器
./dev.sh

# 2. 打开浏览器访问 http://localhost:5173

# 3. 修改代码（如 client/src/pages/Chat.tsx）

# 4. 保存文件（Ctrl+S）

# 5. 浏览器自动刷新，看到修改效果 ⚡

# 6. 继续开发...
```

### 部署到服务器流程

```bash
# 1. 开发完成，测试通过

# 2. 提交代码
git add .
git commit -m "feat: 完成新功能"
git push

# 3. SSH 到服务器
ssh user@server

# 4. 拉取代码
cd /path/to/epkeeper-chatbot
git pull

# 5. 重新部署
docker build --network=host -t epkeeper-chatbot .
docker compose up -d

# 6. 查看日志确认成功
docker compose logs -f
```

---

## 🎉 总结

**记住这个表格：**

| | 开发环境 | 生产环境 |
|---|---------|---------|
| **命令** | `./dev.sh` | `docker build + docker compose up` |
| **速度** | ⚡ 秒级刷新 | 🐌 5-10分钟构建 |
| **热重载** | ✅ 支持 | ❌ 不支持 |
| **使用场景** | 日常开发 | 服务器部署 |
| **网络问题** | ✅ 无影响 | ⚠️ 可能超时 |

**一句话：开发用 `./dev.sh`，部署用 `docker`！**

---

## 📚 详细文档

- **开发指南**：`DEV_GUIDE.md`
- **部署指南**：`QUICK_DEPLOY.md`
- **网络问题**：`NETWORK_ISSUES.md`

