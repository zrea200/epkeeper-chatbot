import { Bot } from 'lucide-react';

interface AvatarPlaceholderProps {
  width?: number;
  height?: number;
  isActive?: boolean;
}

export default function AvatarPlaceholder({
  width = 300,
  height = 400,
  isActive = false,
}: AvatarPlaceholderProps) {
  return (
    <div
      className="relative flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl overflow-hidden shadow-lg"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {/* 背景装饰 */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-20 h-20 bg-blue-400 rounded-full blur-2xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-400 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* 主要图标 */}
      <div className={`relative transition-all duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}>
        <div className="w-40 h-40 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
          <Bot className="w-24 h-24 text-white" strokeWidth={1.5} />
        </div>
        
        {/* 呼吸光环 */}
        {isActive && (
          <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-75" />
        )}
      </div>

      {/* 底部文字 */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-sm font-medium text-gray-700">电管家智能助手</p>
        <p className="text-xs text-gray-500 mt-1">为您服务</p>
      </div>

      {/* 提示：Live2D 模型位置 */}
      <div className="absolute top-4 right-4">
        <div className="px-3 py-1 bg-white/80 backdrop-blur-sm rounded-full text-xs text-gray-600">
          AI 助手
        </div>
      </div>
    </div>
  );
}
