#!/bin/bash

# Docker 构建脚本 - 使用宿主机网络模式解决容器内网络问题

echo "======================================"
echo "开始构建 epkeeper-chatbot Docker 镜像"
echo "======================================"

# 使用 BuildKit 和宿主机网络模式
export DOCKER_BUILDKIT=1

echo "
提示：使用宿主机网络模式构建以解决容器网络问题
构建命令：docker build --network=host -t epkeeper-chatbot .
"

docker build --network=host -t epkeeper-chatbot .

if [ $? -eq 0 ]; then
    echo ""
    echo "======================================"
    echo "✅ 构建成功！"
    echo "======================================"
    echo ""
    echo "运行容器："
    echo "docker run -d -p 3000:3000 --name epkeeper-chatbot epkeeper-chatbot"
else
    echo ""
    echo "======================================"
    echo "❌ 构建失败"
    echo "======================================"
    exit 1
fi

