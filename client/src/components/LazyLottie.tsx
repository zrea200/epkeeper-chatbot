import { lazy, Suspense, memo, useState, useEffect, useRef } from 'react';
import type { DotLottieReactProps } from '@lottiefiles/dotlottie-react';

// 懒加载 DotLottieReact 组件
const DotLottieReact = lazy(() => 
  import('@lottiefiles/dotlottie-react').then(module => ({ default: module.DotLottieReact }))
);

interface LazyLottieProps extends DotLottieReactProps {
  fallback?: React.ReactNode;
  delay?: number; // 延迟加载时间（ms），用于避免阻塞主线程
}

// 加载占位符
const LottieFallback = () => (
  <div className="w-full h-full flex items-center justify-center bg-transparent">
    <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
  </div>
);

/**
 * 优化的懒加载 Lottie 动画组件
 * - 完全延迟加载避免阻塞主线程（至少2秒）
 * - 使用 requestIdleCallback 在空闲时加载
 * - 拆分动画加载任务，避免长任务阻塞
 */
const LazyLottie = memo(({ fallback, delay = 0, ...props }: LazyLottieProps) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 最小延迟时间：确保页面关键内容先渲染
    const MIN_DELAY = 1000; // 至少延迟1秒
    const actualDelay = Math.max(delay, MIN_DELAY);

    // 使用 requestIdleCallback 在浏览器空闲时加载动画，避免阻塞主线程
    const loadAnimation = () => {
      // 先等待最小延迟时间
      setTimeout(() => {
        // 使用 requestIdleCallback 在空闲时加载，拆分任务避免长任务
        const loadInChunks = () => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
              // 再次使用 requestIdleCallback 确保在真正空闲时加载
              requestIdleCallback(() => {
                setShouldLoad(true);
              }, { timeout: 3000 });
            }, { timeout: 3000 });
          } else {
            // 降级方案：使用多个 setTimeout 拆分任务
            setTimeout(() => {
              setTimeout(() => {
                setShouldLoad(true);
              }, 500);
            }, actualDelay);
          }
        };
        loadInChunks();
      }, actualDelay);
    };

    // 使用 Intersection Observer 检测元素是否可见
    if (containerRef.current && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadAnimation();
            observer.disconnect();
          }
        },
        { threshold: 0.1, rootMargin: '50px' } // 提前50px开始加载
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    } else {
      // 降级方案：直接延迟加载
      loadAnimation();
    }
  }, [delay]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ willChange: 'contents' }}>
      {shouldLoad ? (
        <Suspense fallback={fallback || <LottieFallback />}>
          <DotLottieReact {...props} />
        </Suspense>
      ) : (
        fallback || <LottieFallback />
      )}
    </div>
  );
});

LazyLottie.displayName = 'LazyLottie';

export default LazyLottie;

