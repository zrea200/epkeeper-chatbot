# 快速开始 - Docker 部署

这是一个快速部署指南，帮助你在 5 分钟内将应用部署到云服务器。

## 🚀 超快速部署（三步走）

### 1️⃣ 准备服务器

确保你的服务器已安装 Docker 和 Docker Compose：

```bash
# 一键安装 Docker（Ubuntu/Debian）
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo apt-get update
sudo apt-get install -y docker-compose-plugin

# 验证安装
docker --version
docker compose version
```

### 2️⃣ 克隆并启动

```bash
# 克隆项目
git clone <your-repository-url> epkeeper-chatbot
cd epkeeper-chatbot

# 使用部署脚本（推荐）
chmod +x deploy.sh
./deploy.sh --build --up

# 或者手动执行
docker compose up -d --build
```

### 3️⃣ 访问应用

```bash
# 在服务器上测试
curl http://localhost:3000

# 从浏览器访问
http://your-server-ip:3000
```

🎉 **完成！** 应用已经运行在 3000 端口。

---

## 📱 配置域名访问（可选）

如果你想通过域名访问应用：

### 1. 安装 Nginx

```bash
sudo apt-get install -y nginx
```

### 2. 配置反向代理

```bash
# 创建配置文件
sudo nano /etc/nginx/sites-available/epkeeper-chatbot

# 粘贴以下内容（记得替换 your-domain.com）
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 启用配置
sudo ln -s /etc/nginx/sites-available/epkeeper-chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 配置 HTTPS（可选但推荐）

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取 SSL 证书（会自动配置 Nginx）
sudo certbot --nginx -d your-domain.com
```

---

## 🛠️ 常用命令

使用部署脚本（推荐）：

```bash
# 查看帮助
./deploy.sh --help

# 查看日志
./deploy.sh --logs

# 查看状态
./deploy.sh --status

# 重启服务
./deploy.sh --restart

# 停止服务
./deploy.sh --down

# 更新代码并重新部署
./deploy.sh --update

# 清理未使用的资源
./deploy.sh --clean
```

或使用 Docker Compose 命令：

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看日志
docker compose logs -f

# 查看状态
docker compose ps
```

---

## 🔧 环境变量配置

如需自定义配置，创建 `.env` 文件：

```bash
# 复制示例文件
cp env.example .env

# 编辑配置
nano .env
```

`.env` 文件示例：

```env
NODE_ENV=production
PORT=3000
```

然后重新启动服务：

```bash
docker compose up -d
```

---

## 🐛 故障排查

### 端口被占用

```bash
# 检查端口占用
sudo lsof -i :3000

# 或修改端口
PORT=8080 docker compose up -d
```

### 查看详细日志

```bash
# 实时日志
docker compose logs -f

# 最近 100 行日志
docker compose logs --tail=100
```

### 容器无法启动

```bash
# 查看容器状态
docker compose ps

# 检查容器详情
docker inspect epkeeper-chatbot

# 重新构建（清除缓存）
docker compose build --no-cache
docker compose up -d
```

### 清理并重新开始

```bash
# 停止并删除容器
docker compose down

# 清理所有 Docker 资源
docker system prune -a

# 重新构建和启动
docker compose up -d --build
```

---

## 📊 性能优化建议

### 1. 调整资源限制

编辑 `docker-compose.yml`：

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'      # 根据服务器配置调整
      memory: 1024M    # 根据需求调整
```

### 2. 启用 Nginx 缓存

在 Nginx 配置中添加：

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=app_cache:10m max_size=1g inactive=60m;

location / {
    proxy_cache app_cache;
    proxy_cache_valid 200 5m;
    # ... 其他配置
}
```

### 3. 配置日志轮转

创建 `/etc/docker/daemon.json`：

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

重启 Docker：

```bash
sudo systemctl restart docker
```

---

## 🔒 安全建议

1. **配置防火墙**

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

2. **定期更新系统**

```bash
sudo apt-get update && sudo apt-get upgrade -y
```

3. **使用 HTTPS**

始终使用 SSL/TLS 证书保护你的应用。

4. **限制 SSH 访问**

修改 SSH 配置 `/etc/ssh/sshd_config`：

```
PermitRootLogin no
PasswordAuthentication no  # 使用密钥认证
```

---

## 📚 更多信息

- 详细部署指南: [DEPLOYMENT.md](./DEPLOYMENT.md)
- 项目文档: [README.md](./README.md)
- AI 集成文档: [AI_INTEGRATION.md](./AI_INTEGRATION.md)

---

## 🆘 需要帮助？

如果遇到问题：

1. 查看日志：`docker compose logs -f`
2. 检查容器状态：`docker compose ps`
3. 查看系统资源：`docker stats`
4. 检查网络连接：`docker network ls`

常见问题通常可以通过重新构建解决：

```bash
docker compose down
docker compose up -d --build
```

