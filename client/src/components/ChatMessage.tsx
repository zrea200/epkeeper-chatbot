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

export default function ChatMessage({ 
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
        'flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2',
        isBot ? 'justify-start' : 'justify-end'
      )}
    >
      {isBot && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white"
          style={{ borderColor: accentColor, borderWidth: '2px' }}
        >
          <img 
            src={botAvatarUrl} 
            alt="Bot" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 break-words border',
          isBot ? 'text-foreground' : 'text-white'
        )}
        style={
          isBot
            ? { backgroundColor: accentBgColor, borderColor: accentColor }
            : { backgroundColor: accentColor as string, borderColor: accentColor }
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

      {!isBot && (
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-white"
          style={{ borderColor: accentColor, borderWidth: '2px' }}
        >
          <img 
            src={userAvatarUrl} 
            alt="User" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
