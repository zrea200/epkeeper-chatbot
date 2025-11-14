#!/bin/bash
# 部署脚本 - 支持开发/生产环境切换和蓝绿部署

set -e

ENV=${1:-production}
DEPLOYMENT_TYPE=${2:-standard}

echo "🚀 开始部署..."
echo "环境: $ENV"
echo "部署类型: $DEPLOYMENT_TYPE"

# 检查 .env 文件
if [ ! -f .env ]; then
  echo "❌ 错误: .env 文件不存在"
  echo "请复制 env.example 为 .env 并配置"
  exit 1
fi

# 加载环境变量
export $(cat .env | grep -v '^#' | xargs)

# 检查必要的环境变量
if [ -z "$XUNFEI_APP_ID" ] || [ -z "$XUNFEI_API_KEY" ] || [ -z "$XUNFEI_API_SECRET" ]; then
  echo "❌ 错误: 讯飞 API 配置不完整"
  echo "请在 .env 中配置 XUNFEI_APP_ID、XUNFEI_API_KEY、XUNFEI_API_SECRET"
  exit 1
fi

case $DEPLOYMENT_TYPE in
  "blue-green")
    echo "📦 蓝绿部署模式"
    # 启动绿色环境
    docker-compose -f docker-compose.blue-green.yml up -d green
    echo "✅ 绿色环境已启动，端口: 51873"
    echo "📝 测试命令: curl http://localhost:51873/api/health"
    echo "📝 切换流量后，停止蓝色环境: docker-compose -f docker-compose.blue-green.yml stop blue"
    ;;
  
  "canary")
    echo "📦 金丝雀发布模式"
    # 启动金丝雀版本
    docker-compose -f docker-compose.canary.yml up -d canary
    echo "✅ 金丝雀版本已启动，端口: 51874"
    echo "📝 配置负载均衡器：10% 流量到 canary，90% 到 stable"
    ;;
  
  "standard"|*)
    echo "📦 标准部署模式"
    if [ "$ENV" = "development" ]; then
      echo "🔧 开发环境"
      docker-compose -f docker-compose.dev.yml up -d
    else
      echo "🏭 生产环境"
      docker-compose up -d --build
    fi
    ;;
esac

echo "✅ 部署完成！"

