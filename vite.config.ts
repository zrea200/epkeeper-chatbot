import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import basicSsl from '@vitejs/plugin-basic-ssl';

// 是否启用HTTPS
// 
// 说明：
// - 默认禁用 HTTPS（HTTP），因为服务器会使用 Caddy 处理 HTTPS
// - 如果需要在开发环境使用 HTTPS（如手机访问测试），可以设置环境变量：VITE_USE_HTTPS=true
// - 生产环境：禁用 HTTPS（由 Caddy 反向代理处理 HTTPS）
//
// 可以通过环境变量控制：VITE_USE_HTTPS=true 来启用 HTTPS
const useHttps = process.env.VITE_USE_HTTPS === 'true';

const plugins = [
  react(), 
  tailwindcss(), 
  jsxLocPlugin(), 
  // 暂时禁用 manus runtime 插件以减少内联脚本大小
  // 如果必须使用，可以考虑延迟加载或外部化
  // vitePluginManusRuntime(),
  // 启用HTTPS时添加SSL插件
  // 注意：basicSsl 使用自签名证书，浏览器会显示安全警告（这是正常的）
  // 首次访问时，点击"高级" → "继续访问"即可
  ...(useHttps ? [basicSsl({
    name: 'localhost',  // 证书名称，可改为你的域名
    certDir: './.cert',  // 证书存储目录（可选）
  })] : [])
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // 代码分割优化
    rollupOptions: {
      output: {
        // 手动代码分割
        manualChunks: {
          // React 相关库单独打包
          'react-vendor': ['react', 'react-dom'],
          // UI 组件库单独打包
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tooltip'],
          // 动画库单独打包
          'animation-vendor': ['@lottiefiles/dotlottie-react'],
          // 工具库单独打包
          'utils-vendor': ['wouter', 'sonner', 'clsx', 'tailwind-merge'],
        },
        // 优化 chunk 文件名
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico|webp)$/i.test(assetInfo.name || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/\.(woff2?|eot|ttf|otf)$/i.test(assetInfo.name || '')) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[ext]/[name]-[hash][extname]`;
        },
      },
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // 移除特定函数调用
        passes: 2, // 多次压缩以获得更好的压缩率
      },
      format: {
        comments: false, // 移除注释
      },
    },
    // 启用 CSS 代码分割
    cssCodeSplit: true,
    // 提高 chunk 大小警告阈值（因为 Lottie 文件较大）
    chunkSizeWarningLimit: 1000,
    // 启用 sourcemap（生产环境可选）
    sourcemap: false,
    // 优化构建性能
    target: 'esnext',
    // 启用模块预加载提示
    modulePreload: {
      polyfill: true,
    },
  },
  server: {
    port: 3001,
    strictPort: true, // 端口被占用时直接报错，避免自动改端口
    host: true,
    // 代理 API 请求到后端服务器（开发环境）
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
    // HTTPS 由 basicSsl 插件自动处理（开发环境启用插件时）
    // 生产环境不加载插件，使用 HTTP（由 Caddy 处理 HTTPS）
    // allowedHosts 用于 Host 头验证，设置为 true 允许所有主机（开发环境）
    allowedHosts: process.env.NODE_ENV === 'production' ? [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "electric.langcore.net",
      "localhost",
    ] : true,  // 开发环境允许所有主机访问（局域网访问）
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
