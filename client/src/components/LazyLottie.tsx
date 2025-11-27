import { lazy, Suspense, memo, useState, useEffect, useRef } from 'react';
import type { DotLottieReactProps } from '@lottiefiles/dotlottie-react';

// 懒加载 DotLottieReact 组件
const DotLottieReact = lazy(() => 
  import('@lottiefiles/dotlottie-react').then(module => ({ default: module.DotLottieReact }))
);

interface LazyLottieProps extends DotLottieReactProps {
  fallback?: React.ReactNode;
  delay?: number; // 延迟加载时间（ms），用于避免阻塞主线程
  scale?: number; // 缩放比例，例如 0.5 表示缩小到 50%，1.5 表示放大到 150%
  fallbackImage?: string; // 静态图片路径，在动画加载过程中显示
}

// 加载占位符
const LottieFallback = () => (
  <div className="w-full h-full flex items-center justify-center bg-transparent">
    <div className="w-16 h-16 border-4 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
  </div>
);

// DotLottieReact 包装组件，添加错误处理和加载检测
const DotLottieReactWrapper = ({ src, fallbackImage, scale, ...props }: DotLottieReactProps & { fallbackImage?: string; scale?: number }) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isImageVisible, setIsImageVisible] = useState(true); // 图片可见性
  const containerRef = useRef<HTMLDivElement>(null);
  const dotLottieRef = useRef<any>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (src) {
      console.log('[LazyLottie] 加载 .lottie 文件:', src);
      setError(null);
      setIsLoaded(false);
      setIsImageVisible(true); // 重置图片显示状态，src 变化时重新显示图片
    }
  }, [src]);

  // 使用 dotLottieRefCallback 获取实例并确保播放
  useEffect(() => {
    if (dotLottieRef.current) {
      const dotLottie = dotLottieRef.current;
      
      // 监听播放事件
      const onPlay = () => {
        console.log('[LazyLottie] DotLottieReact 动画开始播放');
        setIsLoaded(true);
        // 延迟隐藏图片，确保动画已显示
        setTimeout(() => {
          setIsImageVisible(false);
        }, 50);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      };
      
      const onReady = () => {
        console.log('[LazyLottie] DotLottieReact 动画就绪');
        setIsLoaded(true);
        // 延迟隐藏图片，确保动画已显示
        setTimeout(() => {
          setIsImageVisible(false);
        }, 50);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      };
      
      dotLottie.addEventListener('play', onPlay);
      dotLottie.addEventListener('ready', onReady);
      
      // 确保动画播放
      if (props.autoplay !== false) {
        // 延迟一下确保动画已加载
        setTimeout(() => {
          try {
            dotLottie.play();
            console.log('[LazyLottie] DotLottieReact 手动触发播放');
          } catch (e) {
            console.warn('[LazyLottie] DotLottieReact 播放失败:', e);
          }
        }, 100);
      }
      
      return () => {
        dotLottie.removeEventListener('play', onPlay);
        dotLottie.removeEventListener('ready', onReady);
      };
    }
  }, [dotLottieRef.current, props.autoplay]);

  const handleDotLottieRef = (dotLottie: any) => {
    dotLottieRef.current = dotLottie;
    
    if (dotLottie) {
      console.log('[LazyLottie] DotLottieReact 实例已获取');
    }
  };

  // 检测 canvas 内容变化来确认动画已加载（备用方案）
  useEffect(() => {
    if (!isLoaded && containerRef.current) {
      const checkCanvas = () => {
        const canvas = containerRef.current?.querySelector('canvas');
        if (canvas) {
          try {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              // 检查 canvas 是否有内容（非透明像素）
              const imageData = ctx.getImageData(0, 0, Math.min(canvas.width, 50), Math.min(canvas.height, 50));
              const hasContent = imageData.data.some((val, idx) => idx % 4 !== 3 && val !== 0);
              
              if (hasContent) {
                console.log('[LazyLottie] DotLottieReact Canvas 检测到内容，动画已加载');
                setIsLoaded(true);
                // 延迟隐藏图片，确保动画已显示
                setTimeout(() => {
                  setIsImageVisible(false);
                }, 50);
                if (checkIntervalRef.current) {
                  clearInterval(checkIntervalRef.current);
                  checkIntervalRef.current = null;
                }
                return true;
              }
            }
          } catch (e) {
            // 跨域或其他错误，忽略
          }
        }
        return false;
      };

      // 立即检查一次
      if (checkCanvas()) {
        return;
      }

      // 轮询检查（最多检查3秒）
      let checkCount = 0;
      checkIntervalRef.current = setInterval(() => {
        checkCount++;
        if (checkCanvas() || checkCount > 30) {
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          // 超时后也标记为已加载，避免一直显示 fallback
          if (checkCount > 30) {
            console.warn('[LazyLottie] DotLottieReact 检测超时，强制标记为已加载');
            setIsLoaded(true);
            setIsImageVisible(false);
          }
        }
      }, 100);
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isLoaded, src]);

  // 错误边界处理
  if (error) {
    console.error('[LazyLottie] DotLottieReact 加载失败:', error);
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">动画加载失败</div>
      </div>
    );
  }

  try {
    // 计算缩放样式
    const animationScale = scale ?? 1;
    const scaleStyle = animationScale !== 1 ? {
      transform: `scale(${animationScale})`,
      transformOrigin: 'center center',
    } : {};

    return (
      <div ref={containerRef} className="w-full h-full" style={{ position: 'relative', backgroundColor: '#FFFFFF' }}>
        {/* 静态图片层 - 在动画加载过程中显示 */}
        {fallbackImage && (
          <img
            src={fallbackImage}
            alt="Character fallback"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              opacity: isImageVisible ? 1 : 0,
              transition: 'opacity 300ms ease-out',
              zIndex: 1, // 图片始终在底层
              pointerEvents: isImageVisible ? 'auto' : 'none', // 隐藏时禁用交互
              ...scaleStyle,
            }}
            onLoad={() => {
              console.log('[LazyLottie] 静态图片加载完成:', fallbackImage);
            }}
            onError={(e) => {
              console.error('[LazyLottie] 静态图片加载失败:', fallbackImage);
            }}
          />
        )}
        {/* 动画层 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 300ms ease-out',
            zIndex: 2, // 动画始终在图片上层
            pointerEvents: isLoaded ? 'auto' : 'none',
          }}
        >
          <DotLottieReact 
            src={src} 
            loop={props.loop !== false}
            autoplay={props.autoplay !== false}
            style={{ 
              width: '100%', 
              height: '100%',
              ...scaleStyle,
            }}
            renderConfig={props.renderConfig || {
              devicePixelRatio: window.devicePixelRatio || 1,
              autoResize: true,
            }}
            dotLottieRefCallback={handleDotLottieRef}
            onError={(err: any) => {
              console.error('[LazyLottie] DotLottieReact 错误:', err);
              setError(err?.message || '未知错误');
            }}
            onLoad={() => {
              console.log('[LazyLottie] DotLottieReact onLoad 回调触发');
              setIsLoaded(true);
              // 延迟隐藏图片，确保动画已显示
              setTimeout(() => {
                setIsImageVisible(false);
              }, 50);
              if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
                checkIntervalRef.current = null;
              }
            }}
          />
        </div>
      </div>
    );
  } catch (err: any) {
    console.error('[LazyLottie] DotLottieReact 渲染错误:', err);
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-sm text-gray-500">动画渲染失败</div>
      </div>
    );
  }
};

/**
 * 简洁的懒加载 Lottie 动画组件
 * - 支持 .lottie 格式（使用 DotLottieReact）
 * - 支持 .json 格式（使用 lottie-web）
 */
const LazyLottie = memo(({ fallback, delay = 0, src, scale, fallbackImage, ...props }: LazyLottieProps) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [jsonLoaded, setJsonLoaded] = useState(false);
  const [isImageVisible, setIsImageVisible] = useState(true); // 图片可见性
  const containerRef = useRef<HTMLDivElement>(null);
  const lottieInstanceRef = useRef<any>(null);

  // 判断文件格式
  const isJsonFormat = typeof src === 'string' && src.endsWith('.json');
  const isImageFormat = typeof src === 'string' && (
    src.endsWith('.jpeg') || 
    src.endsWith('.jpg') || 
    src.endsWith('.png') || 
    src.endsWith('.gif') || 
    src.endsWith('.webp') || 
    src.endsWith('.svg')
  );

  // src 变化时重置状态
  useEffect(() => {
    if (src) {
      setIsImageVisible(true); // 重置图片显示状态
      setJsonLoaded(false); // 重置 JSON 加载状态
    }
  }, [src]);

  useEffect(() => {
    // 如果 delay 为 0，立即加载；否则延迟加载
    if (delay === 0) {
      setShouldLoad(true);
    } else {
      // 对于 dotLottie 格式，使用 requestIdleCallback 在浏览器空闲时加载，避免阻塞主线程
      const isDotLottie = typeof src === 'string' && src.endsWith('.lottie');
      
      if (isDotLottie && typeof requestIdleCallback !== 'undefined') {
        // 使用 requestIdleCallback 在浏览器空闲时加载
        const idleCallbackId = requestIdleCallback(
          () => {
            setTimeout(() => {
              setShouldLoad(true);
            }, delay);
          },
          { timeout: delay + 1000 } // 最多等待 delay + 1秒
        );
        return () => cancelIdleCallback(idleCallbackId);
      } else {
        // 回退到 setTimeout
        const timer = setTimeout(() => {
          setShouldLoad(true);
        }, delay);
        return () => clearTimeout(timer);
      }
    }
  }, [delay, src]);

  // JSON 格式使用 lottie-web 加载
  useEffect(() => {
    if (!shouldLoad || !isJsonFormat || !containerRef.current || !src) {
      setJsonLoaded(false);
      return;
    }

    console.log('[LazyLottie] 开始加载 JSON 动画:', src);

    let checkInterval: NodeJS.Timeout | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    const loadLottieJson = async () => {
      try {
        // 销毁旧的动画实例
        if (lottieInstanceRef.current) {
          lottieInstanceRef.current.destroy();
          lottieInstanceRef.current = null;
        }

        setJsonLoaded(false);
        const lottie = await import('lottie-web/build/player/lottie_light');
        if (containerRef.current) {
          console.log('[LazyLottie] 创建 lottie-web 实例');
          // 先获取 JSON 数据，然后加载动画
          try {
            const response = await fetch(src as string);
            const animationData = await response.json();
            // 计算缩放比例
            const animationScale = scale ?? 1;
            
            lottieInstanceRef.current = lottie.default.loadAnimation({
              container: containerRef.current,
              renderer: 'svg',
              loop: props.loop !== false,
              autoplay: props.autoplay !== false,
              animationData: animationData, // 直接使用 JSON 数据而不是 path
              rendererSettings: {
                ...(animationScale !== 1 && {
                  // 通过修改容器尺寸来实现缩放
                  // 注意：lottie-web 没有直接的 scale 参数，需要通过容器尺寸控制
                }),
              },
            });

            // 如果设置了缩放，等待 SVG 渲染后应用
            if (animationScale !== 1 && containerRef.current) {
              const applyScale = () => {
                const svgElement = containerRef.current?.querySelector('svg');
                if (svgElement) {
                  svgElement.style.transform = `scale(${animationScale})`;
                  svgElement.style.transformOrigin = 'center center';
                  return true;
                }
                return false;
              };
              
              // 立即尝试一次
              if (!applyScale()) {
                // 如果 SVG 还没渲染，等待一下再试
                setTimeout(() => {
                  applyScale();
                }, 100);
              }
            }
          } catch (fetchError) {
            // 如果 fetch 失败，回退到使用 path
            console.warn('[LazyLottie] Fetch 失败，使用 path 方式:', fetchError);
            // 计算缩放比例
            const animationScale = scale ?? 1;
            
            lottieInstanceRef.current = lottie.default.loadAnimation({
              container: containerRef.current,
              renderer: 'svg',
              loop: props.loop !== false,
              autoplay: props.autoplay !== false,
              path: src as string,
            });

            // 如果设置了缩放，等待 SVG 渲染后应用
            if (animationScale !== 1 && containerRef.current) {
              const applyScale = () => {
                const svgElement = containerRef.current?.querySelector('svg');
                if (svgElement) {
                  svgElement.style.transform = `scale(${animationScale})`;
                  svgElement.style.transformOrigin = 'center center';
                  return true;
                }
                return false;
              };
              
              // 立即尝试一次
              if (!applyScale()) {
                // 如果 SVG 还没渲染，等待一下再试
                setTimeout(() => {
                  applyScale();
                }, 100);
              }
            }
          }
          
          // 检查容器是否有内容（动画已渲染）
          const checkLoaded = () => {
            if (containerRef.current && containerRef.current.children.length > 0) {
              console.log('[LazyLottie] JSON 动画已加载，子元素数量:', containerRef.current.children.length);
              setJsonLoaded(true);
              // 延迟隐藏图片，确保动画已显示
              setTimeout(() => {
                setIsImageVisible(false);
              }, 50);
              return true;
            }
            return false;
          };

          // 监听各种事件
          const onLoaded = () => {
            console.log('[LazyLottie] 动画加载事件触发');
            setJsonLoaded(true);
            // 延迟隐藏图片，确保动画已显示
            setTimeout(() => {
              setIsImageVisible(false);
            }, 50);
          };

          lottieInstanceRef.current.addEventListener('data_ready', onLoaded);
          lottieInstanceRef.current.addEventListener('DOMLoaded', onLoaded);
          lottieInstanceRef.current.addEventListener('loaded_images', onLoaded);
          lottieInstanceRef.current.addEventListener('complete', onLoaded);

          // 使用轮询检查动画是否已加载（备用方案）
          let checkCount = 0;
          checkInterval = setInterval(() => {
            checkCount++;
            if (checkLoaded() || checkCount > 50) { // 最多检查5秒
              if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
              }
            }
          }, 100);

          // 超时后强制隐藏 fallback
          timeoutId = setTimeout(() => {
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }
            if (containerRef.current && containerRef.current.children.length > 0) {
              console.log('[LazyLottie] 超时后检测到动画已加载');
              setJsonLoaded(true);
              setIsImageVisible(false);
            } else {
              console.warn('[LazyLottie] 超时后仍未检测到动画，强制隐藏 fallback');
              setJsonLoaded(true); // 强制隐藏，避免一直转圈
              setIsImageVisible(false);
            }
          }, 2000);
        }
      } catch (error) {
        console.error('[LazyLottie] 加载 Lottie JSON 动画失败:', error);
        setJsonLoaded(false);
      }
    };

    loadLottieJson();

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (lottieInstanceRef.current) {
        lottieInstanceRef.current.destroy();
        lottieInstanceRef.current = null;
      }
      setJsonLoaded(false);
    };
  }, [shouldLoad, isJsonFormat, src, props.loop, props.autoplay]);

  // 如果是图片格式，直接显示图片
  if (isImageFormat) {
    const imageScale = scale ?? 1;
    const imageScaleStyle = imageScale !== 1 ? {
      transform: `scale(${imageScale})`,
      transformOrigin: 'center center',
    } : {};
    
    return (
      <div 
        className="w-full h-full flex items-center justify-center"
        style={{ position: 'relative', backgroundColor: '#FFFFFF' }}
      >
        <img
          src={src}
          alt="Character animation"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            ...imageScaleStyle,
          }}
          onLoad={() => {
            console.log('[LazyLottie] 图片加载完成:', src);
          }}
          onError={(e) => {
            console.error('[LazyLottie] 图片加载失败:', src);
            // 如果图片加载失败，显示 fallback
            const target = e.target as HTMLImageElement;
            if (target.parentElement) {
              target.parentElement.innerHTML = '';
              const fallbackDiv = document.createElement('div');
              fallbackDiv.className = 'w-full h-full flex items-center justify-center';
              fallbackDiv.innerHTML = '<div class="text-sm text-gray-500">图片加载失败</div>';
              target.parentElement.appendChild(fallbackDiv);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full" 
      style={{ willChange: 'contents', position: 'relative', backgroundColor: '#FFFFFF' }}
    >
      {/* 静态图片层 - 在动画加载过程中显示 */}
      {fallbackImage && (
        <img
          src={fallbackImage}
          alt="Character fallback"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: isImageVisible ? 1 : 0,
            transition: 'opacity 300ms ease-out',
            zIndex: 1, // 图片始终在底层
            pointerEvents: isImageVisible ? 'auto' : 'none', // 隐藏时禁用交互
            ...(scale !== 1 ? {
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
            } : {}),
          }}
          onLoad={() => {
            console.log('[LazyLottie] 静态图片加载完成:', fallbackImage);
          }}
          onError={(e) => {
            console.error('[LazyLottie] 静态图片加载失败:', fallbackImage);
          }}
        />
      )}
      {shouldLoad ? (
        isJsonFormat ? (
          // JSON 格式：显示容器，加载完成后隐藏 fallback
          <>
            {!jsonLoaded && !fallbackImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-transparent z-10">
                {fallback || <LottieFallback />}
              </div>
            )}
            {/* JSON 动画层 - 动画渲染在 containerRef 中 */}
            <div
              ref={containerRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: jsonLoaded ? 1 : 0,
                transition: 'opacity 300ms ease-out',
                zIndex: 2, // 动画始终在图片上层
                pointerEvents: jsonLoaded ? 'auto' : 'none',
              }}
            />
          </>
        ) : (
          <>
            <Suspense fallback={fallbackImage ? null : (fallback || <LottieFallback />)}>
              <DotLottieReactWrapper src={src} fallbackImage={fallbackImage} scale={scale} {...props} />
            </Suspense>
          </>
        )
      ) : (
        fallbackImage ? null : (fallback || <LottieFallback />)
      )}
    </div>
  );
});

LazyLottie.displayName = 'LazyLottie';

export default LazyLottie;

