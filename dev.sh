#!/bin/bash

# 开发环境快速启动脚本

set -e

echo "🚀 启动 EPKeeper Chatbot 开发环境..."
echo ""

# 检查 pnpm 是否安装
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm 未安装"
    echo "📦 正在安装 pnpm..."
    npm install -g pnpm
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 首次运行，正在安装依赖..."
    echo "⏰ 这可能需要 2-5 分钟..."
    pnpm install
    echo "✅ 依赖安装完成！"
    echo ""
fi

# 启动开发服务器
echo "▶️  启动开发服务器（支持热重载）..."
echo ""
echo "📍 开发地址: http://localhost:5173"
echo "💡 修改代码后会自动刷新"
echo "🛑 按 Ctrl+C 停止服务器"
echo ""

pnpm run dev

