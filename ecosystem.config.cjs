/**
 * PM2 配置文件
 * 用于生产环境进程管理
 * 
 * 注意：PM2 会自动从 .env 文件读取环境变量
 * 如果 .env 中有 PORT，会自动使用；如果没有，使用默认值 3000
 */
module.exports = {
  apps: [
    {
      name: 'epkeeper-chatbot',
      script: 'dist/index.js',
      instances: 1, // 单实例运行，如需多实例可改为 'max' 或具体数字
      exec_mode: 'fork', // fork 模式（单实例）或 cluster 模式（多实例）
      // PM2 环境变量配置
      // 注意：env 对象中的值会覆盖 .env 文件
      // 如果 .env 中有 PORT=3001，需要在这里也设置 PORT: 3001，或者使用 env_file 选项
      env: {
        NODE_ENV: 'production',
        PORT: 3001, // 与 .env 文件中的 PORT 保持一致
      },
      // 日志配置
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 自动重启配置
      autorestart: true,
      watch: false, // 生产环境关闭文件监听
      max_memory_restart: '500M', // 内存超过500M自动重启
      // 其他配置
      min_uptime: '10s', // 最小运行时间
      max_restarts: 10, // 最大重启次数
      restart_delay: 4000, // 重启延迟（毫秒）
    },
  ],
};

