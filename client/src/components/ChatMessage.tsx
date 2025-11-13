import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  accentColor?: string;
  accentBgColor?: string;
  botAvatarUrl?: string;
  userAvatarUrl?: string;
}

// 将 hex 颜色转换为 rgba
const hexToRgba = (hex: string, alpha: number): string => {
  if (!hex || !hex.startsWith('#')) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized.length === 3
    ? sanitized.split('').map((c) => c + c).join('')
    : sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ChatMessage = memo(function ChatMessage({ 
  message, 
  accentColor, 
  accentBgColor, 
  botAvatarUrl = '/avatars/Asset5@4x.png',
  userAvatarUrl = '/avatars/Asset5@4x.png'
}: ChatMessageProps) {
  const isBot = message.type === 'bot';
  const isEmpty = !message.content || message.content.trim() === '';
  const isThinking = isBot && isEmpty;

  return (
    <div
      className={cn(
        'flex gap-3 mb-2 animate-in fade-in slide-in-from-bottom-2',
        isBot ? 'justify-start' : 'justify-end'
      )}
    >
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 break-words border shadow-sm',
          isBot ? 'text-foreground' : 'text-white'
        )}
        style={
          isBot
            ? { 
                backgroundColor: accentBgColor || 'rgba(255, 255, 255, 0.3)', 
                borderColor: accentColor,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }
            : { 
                backgroundColor: accentColor ? hexToRgba(accentColor, 0.3) : 'rgba(0, 0, 0, 0.3)', 
                borderColor: accentColor,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }
        }
      >
        {isThinking ? (
          <div className="flex items-center gap-2">
            <Spinner className="size-4" style={{ color: accentColor }} />
            <p className="text-sm leading-relaxed">我在思考中...</p>
          </div>
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        )}
        <span className="text-xs opacity-70 mt-1 block">
          {message.timestamp.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
