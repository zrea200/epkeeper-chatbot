#!/bin/bash

# EPKeeper Chatbot 部署脚本
# 用法: ./deploy.sh [选项]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
EPKeeper Chatbot 部署脚本

用法: ./deploy.sh [选项]

选项:
    -h, --help          显示帮助信息
    -b, --build         构建 Docker 镜像
    -u, --up            启动服务
    -d, --down          停止服务
    -r, --restart       重启服务
    -l, --logs          查看日志
    -s, --status        查看服务状态
    --clean             清理未使用的 Docker 资源
    --update            更新代码并重新部署

示例:
    ./deploy.sh --build --up    # 构建并启动服务
    ./deploy.sh --logs          # 查看日志
    ./deploy.sh --update        # 更新并重新部署
EOF
}

# 检查必要的命令
check_requirements() {
    print_info "检查系统要求..."
    check_command "docker"
    check_command "git"
    
    # 检查 docker compose 命令
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose 未安装或版本过低"
        print_info "请安装 Docker Compose v2+"
        exit 1
    fi
    
    print_info "系统要求检查通过 ✓"
}

# 构建镜像
build_image() {
    print_info "开始构建 Docker 镜像..."
    docker compose build --no-cache
    print_info "Docker 镜像构建完成 ✓"
}

# 启动服务
start_service() {
    print_info "启动服务..."
    docker compose up -d
    print_info "服务已启动 ✓"
    print_info "访问地址: http://localhost:3000"
}

# 停止服务
stop_service() {
    print_info "停止服务..."
    docker compose down
    print_info "服务已停止 ✓"
}

# 重启服务
restart_service() {
    print_info "重启服务..."
    docker compose restart
    print_info "服务已重启 ✓"
}

# 查看日志
show_logs() {
    print_info "显示服务日志 (按 Ctrl+C 退出)..."
    docker compose logs -f --tail=100
}

# 查看状态
show_status() {
    print_info "服务状态:"
    docker compose ps
    echo ""
    print_info "资源使用情况:"
    docker stats --no-stream epkeeper-chatbot 2>/dev/null || print_warning "容器未运行"
}

# 清理资源
clean_resources() {
    print_warning "即将清理未使用的 Docker 资源..."
    read -p "是否继续? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "清理未使用的镜像..."
        docker image prune -f
        print_info "清理未使用的容器..."
        docker container prune -f
        print_info "清理完成 ✓"
    else
        print_info "取消清理操作"
    fi
}

# 更新并重新部署
update_and_deploy() {
    print_info "拉取最新代码..."
    git pull
    
    print_info "停止当前服务..."
    docker compose down
    
    print_info "构建新镜像..."
    docker compose build --no-cache
    
    print_info "启动服务..."
    docker compose up -d
    
    print_info "清理旧镜像..."
    docker image prune -f
    
    print_info "更新部署完成 ✓"
    print_info "访问地址: http://localhost:3000"
}

# 主函数
main() {
    # 如果没有参数，显示帮助
    if [ $# -eq 0 ]; then
        show_help
        exit 0
    fi
    
    # 检查系统要求
    check_requirements
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -b|--build)
                build_image
                shift
                ;;
            -u|--up)
                start_service
                shift
                ;;
            -d|--down)
                stop_service
                shift
                ;;
            -r|--restart)
                restart_service
                shift
                ;;
            -l|--logs)
                show_logs
                shift
                ;;
            -s|--status)
                show_status
                shift
                ;;
            --clean)
                clean_resources
                shift
                ;;
            --update)
                update_and_deploy
                shift
                ;;
            *)
                print_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 执行主函数
main "$@"

