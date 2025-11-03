# Docker 部署指南

本指南将帮助你使用 Docker 将 EPKeeper Chatbot 项目部署到云服务器。

## 📋 前置要求

在开始之前，请确保你的云服务器已经安装：

- Docker (v20.10+)
- Docker Compose (v2.0+)
- Git

### 安装 Docker 和 Docker Compose（Ubuntu/Debian）

```bash
# 更新包索引
sudo apt-get update

# 安装必要的包
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 将当前用户添加到 docker 组（避免每次使用 sudo）
sudo usermod -aG docker $USER

# 重新登录或运行以下命令使组更改生效
newgrp docker

# 验证安装
docker --version
docker compose version
```

## 🚀 部署步骤

### 方法一：使用 Docker Compose（推荐）

#### 1. 克隆项目到服务器

```bash
# SSH 登录到你的云服务器
ssh user@your-server-ip

# 克隆项目
git clone <your-repository-url> epkeeper-chatbot
cd epkeeper-chatbot
```

#### 2. 配置环境变量（可选）

如果需要自定义配置，可以创建 `.env` 文件：

```bash
cat > .env << EOF
NODE_ENV=production
PORT=3000
EOF
```

#### 3. 构建并启动容器

```bash
# 构建并启动服务
docker compose up -d --build

# 查看日志
docker compose logs -f

# 查看运行状态
docker compose ps
```

#### 4. 验证部署

```bash
# 检查容器状态
docker compose ps

# 测试应用是否正常运行
curl http://localhost:3000
```

#### 5. 常用管理命令

```bash
# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看实时日志
docker compose logs -f

# 更新代码后重新部署
git pull
docker compose up -d --build

# 清理旧的镜像
docker image prune -f
```

### 方法二：直接使用 Docker

#### 1. 构建镜像

```bash
docker build -t epkeeper-chatbot:latest .
```

#### 2. 运行容器

```bash
docker run -d \
  --name epkeeper-chatbot \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  epkeeper-chatbot:latest
```

#### 3. 常用管理命令

```bash
# 查看日志
docker logs -f epkeeper-chatbot

# 停止容器
docker stop epkeeper-chatbot

# 启动容器
docker start epkeeper-chatbot

# 删除容器
docker rm -f epkeeper-chatbot

# 查看容器状态
docker ps
```

## 🌐 配置反向代理（使用 Nginx）

为了使用域名访问应用并配置 HTTPS，建议使用 Nginx 作为反向代理。

### 1. 安装 Nginx

```bash
sudo apt-get install -y nginx
```

### 2. 配置 Nginx

创建 Nginx 配置文件：

```bash
sudo nano /etc/nginx/sites-available/epkeeper-chatbot
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/epkeeper-chatbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 配置 HTTPS（使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com

# Certbot 会自动配置 Nginx 并设置自动续期
```

## 🔧 服务器防火墙配置

确保服务器防火墙允许必要的端口：

```bash
# UFW 防火墙（Ubuntu）
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 22/tcp    # SSH
sudo ufw enable

# 查看防火墙状态
sudo ufw status
```

## 📊 监控和维护

### 查看资源使用情况

```bash
# 查看容器资源使用
docker stats epkeeper-chatbot

# 查看磁盘使用
docker system df
```

### 日志管理

```bash
# 查看最近 100 行日志
docker compose logs --tail=100

# 查看实时日志
docker compose logs -f --tail=50

# 清理日志（如果日志文件过大）
sudo truncate -s 0 /var/lib/docker/containers/*/*-json.log
```

### 自动备份（可选）

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/home/backup/epkeeper-chatbot"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 备份容器数据
docker compose exec epkeeper-chatbot tar czf - /app/data > "$BACKUP_DIR/data_$DATE.tar.gz"

# 保留最近 7 天的备份
find $BACKUP_DIR -name "data_*.tar.gz" -mtime +7 -delete

echo "Backup completed: data_$DATE.tar.gz"
```

设置定时任务：

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 2 点执行备份
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

## 🔄 更新部署

当有代码更新时：

```bash
# 进入项目目录
cd epkeeper-chatbot

# 拉取最新代码
git pull

# 重新构建并启动
docker compose up -d --build

# 清理旧镜像
docker image prune -f
```

## 🐛 故障排查

### 容器无法启动

```bash
# 查看详细日志
docker compose logs

# 检查端口占用
sudo netstat -tlnp | grep 3000

# 检查 Docker 服务状态
sudo systemctl status docker
```

### 应用访问缓慢

```bash
# 检查资源使用
docker stats

# 检查容器健康状态
docker inspect --format='{{.State.Health.Status}}' epkeeper-chatbot

# 查看系统资源
htop
df -h
free -h
```

### 构建失败

```bash
# 清理 Docker 构建缓存
docker builder prune -a

# 重新构建（不使用缓存）
docker compose build --no-cache

# 检查磁盘空间
df -h
```

## 📝 注意事项

1. **安全性**：
   - 定期更新系统和 Docker
   - 使用强密码和 SSH 密钥认证
   - 配置防火墙规则
   - 启用 HTTPS

2. **性能优化**：
   - 根据服务器配置调整 `docker-compose.yml` 中的资源限制
   - 考虑使用 CDN 加速静态资源
   - 启用 Nginx 缓存

3. **监控**：
   - 设置日志轮转避免磁盘占满
   - 配置应用监控（如 Prometheus + Grafana）
   - 设置告警通知

4. **备份**：
   - 定期备份重要数据
   - 测试备份恢复流程

## 🆘 获取帮助

如遇到问题，请检查：
- 容器日志：`docker compose logs -f`
- Nginx 日志：`sudo tail -f /var/log/nginx/error.log`
- 系统日志：`sudo journalctl -u docker -f`

## 📚 更多资源

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Nginx 文档](https://nginx.org/en/docs/)
- [Let's Encrypt 文档](https://letsencrypt.org/docs/)

