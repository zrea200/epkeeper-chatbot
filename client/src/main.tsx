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

createRoot(document.getElementById("root")!).render(<App />);
