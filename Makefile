# EPKeeper Chatbot - Makefile
# 简化 Docker 操作命令

.PHONY: help build up down restart logs status clean update test

# 默认目标
.DEFAULT_GOAL := help

# 颜色输出
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
NC := \033[0m

help: ## 显示帮助信息
	@echo "$(GREEN)EPKeeper Chatbot - 可用命令:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(BLUE)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)示例:$(NC)"
	@echo "  make build    # 构建 Docker 镜像"
	@echo "  make up       # 启动服务"
	@echo "  make logs     # 查看日志"

build: ## 构建 Docker 镜像
	@echo "$(GREEN)构建 Docker 镜像...$(NC)"
	docker compose build --no-cache

up: ## 启动服务（后台运行）
	@echo "$(GREEN)启动服务...$(NC)"
	docker compose up -d
	@echo "$(GREEN)✓ 服务已启动，访问 http://localhost:3000$(NC)"

down: ## 停止并删除容器
	@echo "$(YELLOW)停止服务...$(NC)"
	docker compose down

start: ## 启动已存在的容器
	@echo "$(GREEN)启动容器...$(NC)"
	docker compose start

stop: ## 停止容器（不删除）
	@echo "$(YELLOW)停止容器...$(NC)"
	docker compose stop

restart: ## 重启服务
	@echo "$(GREEN)重启服务...$(NC)"
	docker compose restart
	@echo "$(GREEN)✓ 服务已重启$(NC)"

logs: ## 查看实时日志
	@echo "$(BLUE)显示服务日志 (按 Ctrl+C 退出)...$(NC)"
	docker compose logs -f --tail=100

status: ## 查看服务状态
	@echo "$(BLUE)服务状态:$(NC)"
	docker compose ps
	@echo ""
	@echo "$(BLUE)资源使用:$(NC)"
	@docker stats --no-stream epkeeper-chatbot 2>/dev/null || echo "$(YELLOW)容器未运行$(NC)"

clean: ## 清理未使用的 Docker 资源
	@echo "$(YELLOW)清理 Docker 资源...$(NC)"
	docker image prune -f
	docker container prune -f
	@echo "$(GREEN)✓ 清理完成$(NC)"

clean-all: ## 清理所有 Docker 资源（危险操作）
	@echo "$(YELLOW)⚠️  这将清理所有未使用的 Docker 资源！$(NC)"
	@read -p "确定继续? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker system prune -a -f; \
		echo "$(GREEN)✓ 清理完成$(NC)"; \
	else \
		echo "$(YELLOW)取消操作$(NC)"; \
	fi

update: ## 更新代码并重新部署
	@echo "$(GREEN)更新代码...$(NC)"
	git pull
	@echo "$(GREEN)重新构建和部署...$(NC)"
	$(MAKE) down
	$(MAKE) build
	$(MAKE) up
	@echo "$(GREEN)✓ 更新完成$(NC)"

deploy: build up ## 构建并部署（完整部署流程）

redeploy: down deploy ## 停止现有服务并重新部署

dev: ## 启动开发环境
	@echo "$(GREEN)启动开发环境...$(NC)"
	pnpm install
	pnpm run dev

install: ## 安装依赖
	@echo "$(GREEN)安装项目依赖...$(NC)"
	pnpm install

test: ## 运行测试（如果有）
	@echo "$(GREEN)运行测试...$(NC)"
	pnpm run check

shell: ## 进入容器 shell
	@echo "$(BLUE)进入容器 shell...$(NC)"
	docker compose exec epkeeper-chatbot sh

inspect: ## 查看容器详细信息
	@echo "$(BLUE)容器详细信息:$(NC)"
	docker inspect epkeeper-chatbot

backup: ## 备份容器数据
	@echo "$(GREEN)备份数据...$(NC)"
	@mkdir -p backups
	@docker compose exec epkeeper-chatbot tar czf - /app/data 2>/dev/null > backups/backup_$$(date +%Y%m%d_%H%M%S).tar.gz || echo "$(YELLOW)没有数据需要备份$(NC)"
	@echo "$(GREEN)✓ 备份完成$(NC)"

health: ## 检查应用健康状态
	@echo "$(BLUE)检查应用健康状态...$(NC)"
	@curl -f http://localhost:3000 > /dev/null 2>&1 && echo "$(GREEN)✓ 应用运行正常$(NC)" || echo "$(YELLOW)⚠️  应用无响应$(NC)"

# 生产环境相关命令
prod-build: ## 生产环境构建
	@echo "$(GREEN)生产环境构建...$(NC)"
	NODE_ENV=production docker compose build --no-cache

prod-up: ## 生产环境启动
	@echo "$(GREEN)生产环境启动...$(NC)"
	NODE_ENV=production docker compose up -d

prod-logs: ## 生产环境日志
	@echo "$(BLUE)生产环境日志...$(NC)"
	docker compose logs -f --tail=200

# 监控相关
monitor: ## 持续监控资源使用
	@echo "$(BLUE)监控资源使用 (按 Ctrl+C 退出)...$(NC)"
	watch -n 2 docker stats epkeeper-chatbot

# 网络相关
network: ## 查看网络信息
	@echo "$(BLUE)Docker 网络信息:$(NC)"
	docker network ls
	@echo ""
	@echo "$(BLUE)容器网络详情:$(NC)"
	docker network inspect epkeeper-chatbot_app-network 2>/dev/null || echo "$(YELLOW)网络未创建$(NC)"

