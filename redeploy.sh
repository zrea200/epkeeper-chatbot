#!/bin/bash

# 快速重新部署脚本（使用缓存，速度快）
# 用于代码修改后快速更新部署

set -e

echo "🚀 开始重新部署 EPKeeper Chatbot..."

# 停止并删除旧容器
echo "📦 停止旧容器..."
docker compose down

# 重新构建镜像（使用缓存，速度快）
echo "🔨 构建新镜像（使用缓存加速）..."
docker compose build

# 启动新容器
echo "▶️  启动新容器..."
docker compose up -d

# 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo ""
echo "✅ 部署完成！"
echo "🌐 访问地址: http://localhost:51872"
echo ""
echo "💡 查看日志: docker compose logs -f"
echo "💡 查看状态: docker compose ps"

