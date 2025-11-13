import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 在开发环境或通过 URL 参数启用移动端调试工具
// 已禁用 vconsole
// if (import.meta.env.DEV || new URLSearchParams(window.location.search).get('vconsole') === '1') {
//   import('vconsole').then((module) => {
//     const VConsole = module.default;
//     new VConsole({
//       theme: 'dark',
//       defaultPlugins: ['system', 'network', 'element', 'storage'],
//       maxLogNumber: 1000,
//       onReady: () => {
//         console.log('✅ vConsole 已启用，可以在移动端查看控制台日志');
//       }
//     });
//   });
// }

// 立即渲染React应用，但使用Scheduler优化
// 注意：React 18+ 已经内置了并发渲染优化
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
