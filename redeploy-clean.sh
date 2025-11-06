#!/bin/bash

# 完全清理重新部署脚本（不使用缓存，速度慢但彻底）
# 用于依赖更新或配置大改时使用

set -e

echo "🚀 开始完全清理重新部署 EPKeeper Chatbot..."
echo "⚠️  警告：不使用缓存，构建会比较慢（约5-10分钟）"
echo ""

# 停止并删除旧容器
echo "📦 停止旧容器..."
docker compose down

# 完全清理构建缓存
echo "🧹 清理构建缓存..."
docker builder prune -f

# 重新构建镜像（不使用缓存）
echo "🔨 构建新镜像（不使用缓存）..."
docker compose build --no-cache

# 启动新容器
echo "▶️  启动新容器..."
docker compose up -d

# 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo ""
echo "✅ 完全清理部署完成！"
echo "🌐 访问地址: http://localhost:51872"
echo ""
echo "💡 查看日志: docker compose logs -f"
echo "💡 查看状态: docker compose ps"

