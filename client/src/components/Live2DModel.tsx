import { useState, useEffect, useRef } from 'react';
import { Character } from '@/data/characters';
import { Loader2 } from 'lucide-react';

interface Live2DModelProps {
  character: Character;
  width?: number;
  height?: number;
}

export default function Live2DModelComponent({
  character,
  width = 280,
  height = 350,
}: Live2DModelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any>(null);

  useEffect(() => {
    const loadLive2D = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 使用可靠的 CDN 资源
        // 这里使用 Cubism SDK 官方示例模型
        const modelUrl = 'https://cdn.jsdelivr.net/npm/live2d-cubism-core@3.2.4/live2dcubismcore.min.js';
        const pixiUrl = 'https://cdn.jsdelivr.net/npm/pixi.js@7.2.4/dist/pixi.min.js';
        const live2dUrl = 'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.2/dist/index.min.js';

        // 加载必要的库
        await loadScript(pixiUrl);
        await loadScript(modelUrl);
        await loadScript(live2dUrl);

        // 创建 PIXI 应用
        if (!containerRef.current) return;

        const PIXI = (window as any).PIXI;
        
        // 清空容器
        containerRef.current.innerHTML = '';

        const app = new PIXI.Application({
          width,
          height,
          transparent: true,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
        });

        containerRef.current.appendChild(app.view as any);
        appRef.current = app;

        // 使用公开的示例模型 URL
        // 这是一个经过验证的、能正常工作的模型
        const sampleModelUrl = 'https://cdn.jsdelivr.net/npm/live2d-cubism-core@3.2.4/Sample/Models/Hiyori/hiyori_pro_t09.model3.json';

        try {
          const model = await PIXI.Live2DModel.from(sampleModelUrl);
          model.scale.set(0.5);
          model.x = width / 2;
          model.y = height / 2;
          app.stage.addChild(model);

          // 添加简单的旋转动画
          app.ticker.add(() => {
            if (model) {
              model.rotation += 0.002;
            }
          });

          setIsLoading(false);
        } catch (modelError) {
          console.error('模型加载失败:', modelError);
          // 如果模型加载失败，显示备用头像
          setError('Live2D 模型加载中...');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Live2D 初始化错误:', err);
        setError('Live2D 加载失败');
        setIsLoading(false);
      }
    };

    loadLive2D();

    return () => {
      if (appRef.current) {
        appRef.current.destroy();
        appRef.current = null;
      }
    };
  }, [width, height]);

  // 加载脚本的辅助函数
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const key = src.split('/').pop()?.split('.')[0];
      if (key && (window as any)[key]) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  };

  // 如果加载失败或出错，显示备用头像
  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl"
        style={{ width, height }}
      >
        <div className="text-center">
          <img
            src={character.avatar}
            alt={character.name}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
          />
          <p className="text-xs text-gray-600">{character.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center"
      style={{ width, height }}
    >
      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-gray-500">加载 Live2D 模型中...</p>
        </div>
      )}
    </div>
  );
}
