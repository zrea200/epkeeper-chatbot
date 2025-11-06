# 🛠️ 开发环境指南

## 🎯 问题分析

您遇到的问题：
- ❌ 每次修改代码都要重新打包（5-10分钟）
- ❌ 网络超时导致构建失败
- ❌ 开发效率太低

**根本原因：**
- 混淆了**开发环境**和**生产环境**
- 开发时不应该用 Docker 打包！

---

## ✅ 正确的开发流程

### 开发环境（本地运行，推荐 ⭐⭐⭐⭐⭐）

**特点：**
- ⚡ 修改代码后**自动热重载**（秒级更新）
- 🔧 不需要重新打包
- 💻 直接在本地运行

**启动命令：**
```bash
cd /home/zrea/epkeeper-chatbot

# 安装依赖（首次运行）
pnpm install

# 启动开发服务器（支持热重载）
pnpm run dev
```

**访问地址：**
- 开发服务器：http://localhost:5173
- 后端API（如果有）：http://localhost:3000

**修改代码后：**
- 保存文件 → 浏览器自动刷新 ⚡
- **无需任何打包操作！**

---

### 生产环境（Docker 部署）

**特点：**
- 📦 打包成镜像部署到服务器
- 🔒 稳定、安全
- 🚀 只在部署时使用

**部署命令：**
```bash
# 方案1：Docker Compose（如果网络正常）
docker compose up -d --build

# 方案2：使用 host 网络（解决网络问题）
docker build --network=host -t epkeeper-chatbot .
docker compose up -d
```

---

## 📊 开发环境 vs 生产环境

| 特性 | 开发环境 | 生产环境 |
|-----|---------|---------|
| **运行方式** | 本地 `pnpm run dev` | Docker 容器 |
| **更新速度** | ⚡ 秒级热重载 | 🐌 需重新打包（5-10分钟） |
| **是否打包** | ❌ 不打包 | ✅ 打包构建 |
| **使用场景** | 日常开发、调试 | 部署到服务器 |
| **网络问题** | ✅ 不受影响 | ⚠️ 可能超时 |

---

## 🚀 推荐的完整工作流

### 1️⃣ 日常开发（在本地）

```bash
# 首次启动
cd /home/zrea/epkeeper-chatbot
pnpm install
pnpm run dev

# 之后每次开发
pnpm run dev  # 启动开发服务器
# 修改代码 → 自动刷新 → 继续开发
```

**优点：**
- ⚡ **超快**：修改即生效
- 🔧 完整的开发工具支持
- 🐛 方便调试

---

### 2️⃣ 测试部署（在服务器或本地 Docker）

```bash
# 开发完成后，测试生产环境
docker build --network=host -t epkeeper-chatbot .
docker compose up -d

# 测试没问题后，提交代码
git add .
git commit -m "feat: 完成新功能"
git push
```

---

### 3️⃣ 生产部署（在服务器）

```bash
# SSH 到服务器
ssh user@server

# 拉取最新代码
cd /path/to/epkeeper-chatbot
git pull

# 重新部署
docker build --network=host -t epkeeper-chatbot .
docker compose up -d
```

---

## 🔧 使用 Docker 开发环境（可选，不推荐）

如果您坚持要用 Docker 开发，可以使用我创建的配置：

### 方案A：简单模式（无需打包）

```bash
# 启动开发容器（挂载代码，支持热重载）
docker compose -f docker-compose.dev-simple.yml up -d --build

# 查看日志
docker compose -f docker-compose.dev-simple.yml logs -f
```

**特点：**
- 代码挂载到容器
- 修改代码自动生效
- 首次启动需要安装依赖（2-3分钟）
- 之后修改代码**不需要重启**

---

### 方案B：极简模式（不构建镜像）

```bash
# 直接运行开发容器
docker compose -f docker-compose.dev.yml up -d

# 查看日志
docker compose -f docker-compose.dev.yml logs -f
```

**特点：**
- 使用官方 node 镜像
- 启动时自动安装依赖
- 代码热重载

---

## 🌐 解决网络问题

### 为什么会超时？

Docker 构建时访问国外源（Alpine、npm、GitHub）慢或超时。

### 临时方案：使用 host 网络

```bash
# 构建时使用 host 网络（绕过 Docker 网络限制）
docker build --network=host -t epkeeper-chatbot .

# 或者开发环境使用
docker compose -f docker-compose.dev-simple.yml up -d
```

### 永久方案：配置镜像源

已在 `Dockerfile.dev` 中配置，使用国内镜像加速。

---

## 📝 命令速查表

### 本地开发（推荐）

```bash
# 安装依赖
pnpm install

# 启动开发服务器（热重载）
pnpm run dev

# 构建生产版本（测试用）
pnpm run build

# 预览生产版本
pnpm run preview
```

### Docker 开发

```bash
# 启动开发容器（热重载）
docker compose -f docker-compose.dev-simple.yml up -d

# 查看日志
docker compose -f docker-compose.dev-simple.yml logs -f

# 停止容器
docker compose -f docker-compose.dev-simple.yml down
```

### Docker 生产部署

```bash
# 方案1：正常部署
docker compose up -d --build

# 方案2：解决网络问题
docker build --network=host -t epkeeper-chatbot .
docker compose up -d
```

---

## 💡 最佳实践

### ✅ 推荐做法

1. **开发时**：本地运行 `pnpm run dev`
2. **测试时**：本地 Docker 测试 `docker build && docker compose up`
3. **部署时**：服务器 Docker 部署

### ❌ 不推荐做法

1. ~~每次修改都 Docker 打包~~（太慢）
2. ~~开发环境用生产配置~~（效率低）
3. ~~不用热重载~~（浪费时间）

---

## 🎯 总结

**记住一点：**

```bash
# 开发 = 本地运行（快！）
pnpm run dev

# 部署 = Docker 打包（慢，但稳定）
docker build --network=host -t epkeeper-chatbot .
docker compose up -d
```

**开发和部署是两回事，不要混在一起！** 🎉

---

## ❓ 常见问题

**Q: 为什么开发要用本地，不用 Docker？**

A: 
- 本地开发有热重载，修改代码秒级生效
- Docker 需要重新打包，每次 5-10 分钟
- 开发效率差几十倍

**Q: 什么时候需要用 Docker？**

A: 
- 部署到服务器时
- 测试生产环境时
- 多人协作需要统一环境时

**Q: 网络问题怎么解决？**

A: 
- 开发环境：不需要 Docker，没有网络问题
- 生产部署：使用 `--network=host` 参数

**Q: 修改了配置文件需要重启吗？**

A: 
- 本地开发：大部分配置会自动重载
- Docker 容器：需要重启容器

