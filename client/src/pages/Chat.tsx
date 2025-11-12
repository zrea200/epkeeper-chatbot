import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChatMessage, { Message } from '@/components/ChatMessage';
import Live2DModel from '@/components/Live2DModel';
import { 
  findBestAnswer,
  findExactAnswer,
  getQuickQuestions,
  getContactInfo,
  getFallbackResponse,
  getAIResponseStream,
} from '@/lib/qa-matcher';
import { getSmartRecommendations, Recommendation } from '@/lib/smart-recommendations';
import { characters, Character, getDefaultCharacter } from '@/data/characters';
import { SpeechRecognizer, SpeechSynthesizer } from '@/lib/speech';
import { toast } from 'sonner';
import { Volume2, VolumeX, Mic, Send } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import AI_CONFIG from '@/config/ai-config';

export default function Chat() {
  // 状态管理
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]); // 可见的消息列表
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(getDefaultCharacter());
  const [smartRecommendations, setSmartRecommendations] = useState<Recommendation[]>([]);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);

  const hexToRgba = (hex: string, alpha: number) => {
    const sanitized = hex.replace('#', '');
    const bigint = parseInt(sanitized.length === 3
      ? sanitized.split('').map((c) => c + c).join('')
      : sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // 引用
  const messageViewportRef = useRef<HTMLDivElement>(null);
  const speechRecognizerRef = useRef<SpeechRecognizer | null>(null);
  const speechSynthesizerRef = useRef<SpeechSynthesizer | null>(null);
  const lastTriggerTimeRef = useRef<number>(0);

  // 初始化
  useEffect(() => {
    // 初始化语音识别和合成
    speechRecognizerRef.current = new SpeechRecognizer();
    speechSynthesizerRef.current = new SpeechSynthesizer();

    // 添加欢迎消息
    const welcomeMessage: Message = {
      id: '0',
      content: selectedCharacter.greeting,
      type: 'bot',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);

    // 获取快捷问题
    const quickQuestions = getQuickQuestions();
    if (quickQuestions.length > 0) {
      setSmartRecommendations(
        quickQuestions.slice(0, 3).map((q) => ({
          question: q,
          category: '快捷问题',
        }))
      );
    }
  }, [selectedCharacter]);

  // 智能管理可见消息：类似虚拟列表，保持最新的消息可见
  useEffect(() => {
    // 最多显示最近的 20 条消息（可调整）
    const MAX_VISIBLE_MESSAGES = 20;
    
    if (messages.length <= MAX_VISIBLE_MESSAGES) {
      setVisibleMessages(messages);
    } else {
      // 只保留最新的消息
      setVisibleMessages(messages.slice(-MAX_VISIBLE_MESSAGES));
    }
  }, [messages]);

  // 自动滚动到底部
  useEffect(() => {
    const scrollToBottom = () => {
      const viewport = messageViewportRef.current;
      if (!viewport) return;

      const targetScrollTop = viewport.scrollHeight - viewport.clientHeight;

      requestAnimationFrame(() => {
        viewport.scrollTop = targetScrollTop < 0 ? 0 : targetScrollTop;
        console.debug(
          '[Chat] 自动滚动触发',
          {
            messageCount: visibleMessages.length,
            scrollTop: viewport.scrollTop,
            scrollHeight: viewport.scrollHeight,
            clientHeight: viewport.clientHeight,
          }
        );
      });
    };

    // 使用多次 requestAnimationFrame 确保 DOM 完全更新
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom();
        // 再延迟一次确保内容完全渲染
        setTimeout(scrollToBottom, 100);
        setTimeout(scrollToBottom, 300);
      });
    });
  }, [visibleMessages, smartRecommendations]);

  // 停止当前语音播放
  const stopCurrentSpeech = () => {
    if (speechSynthesizerRef.current) {
      speechSynthesizerRef.current.stop();
      setIsSpeaking(false);
    }
  };

  // 处理发送消息
  // @param text 用户输入的问题
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    // 开始新的对话前，先停止当前正在播放的语音
    stopCurrentSpeech();

    // 添加用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      content: text,
      type: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // 设置思考状态
    setIsThinking(true);

    // 无论来源如何，先尝试精确匹配数据库中的标准问题
    // 这样可以保证：点击推荐问题和手动输入相同问题时，答案一致
    const exactMatch = findExactAnswer(text);
    
    if (exactMatch) {
      // 精确匹配到数据库中的问题，直接返回答案，不走后端
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: exactMatch.answer,
          type: 'bot',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setIsThinking(false);

        // 获取智能推荐
        const recommendations = getSmartRecommendations(
          text,
          assistantMessage.content,
          messages.map((m) => m.content)
        );
        setSmartRecommendations(recommendations);

        // 语音播报
        if (voiceEnabled && speechSynthesizerRef.current) {
          setIsSpeaking(true);
          speechSynthesizerRef.current.speak(assistantMessage.content, {
            characterId: selectedCharacter.id,
            onEnd: () => {
              setIsSpeaking(false);
            },
          });
        }
      }, 300); // 本地匹配响应更快，减少延迟
      return;
    }

    // 精确匹配失败，走 AI 后端处理个性化问题

    // 本地未匹配到，且 AI 功能未启用，返回兜底回复
    if (!AI_CONFIG.enabled) {
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: getFallbackResponse(),
          type: 'bot',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setIsThinking(false);

        // 获取智能推荐
        const recommendations = getSmartRecommendations(
          text,
          assistantMessage.content,
          messages.map((m) => m.content)
        );
        setSmartRecommendations(recommendations);

        // 语音播报
        if (voiceEnabled && speechSynthesizerRef.current) {
          setIsSpeaking(true);
          speechSynthesizerRef.current.speak(assistantMessage.content, {
            characterId: selectedCharacter.id,
            onEnd: () => {
              setIsSpeaking(false);
            },
          });
        }
      }, 800);
      return;
    }

    // 本地未匹配到，且 AI 功能已启用，调用后端 AI
    // 创建一个空的助手消息，用于流式更新
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: '',
      type: 'bot',
      timestamp: new Date(),
    };

    // 添加空消息到列表
    setMessages((prev) => [...prev, assistantMessage]);

    // 用于累积完整回复内容（用于智能推荐和语音播报）
    let fullResponse = '';

    // 调用 AI 流式接口（默认不启用打字机效果，避免页面抖动）
    getAIResponseStream(
      text,
      selectedCharacter.id, // 传递角色ID，用于设置角色提示
      // 收到数据块时的回调（chunk 是累积的完整文本）
      (chunk: string) => {
        setIsThinking(false);
        setIsSpeaking(true);
        fullResponse = chunk; // 直接使用传入的完整文本
        
        // 更新消息内容（使用函数式更新，避免依赖 messages）
        setMessages((prev) => 
          prev.map((msg) => 
            msg.id === assistantMessageId 
              ? { ...msg, content: chunk }
              : msg
          )
        );
      },
      // 完成时的回调
      () => {
        setIsThinking(false);
        setIsSpeaking(false);

        // 获取智能推荐
        const recommendations = getSmartRecommendations(
          text,
          fullResponse,
          messages.map((m) => m.content)
        );
        setSmartRecommendations(recommendations);

        // 语音播报完整内容
        if (voiceEnabled && speechSynthesizerRef.current && fullResponse) {
          setIsSpeaking(true);
          speechSynthesizerRef.current.speak(fullResponse, {
            characterId: selectedCharacter.id,
            onEnd: () => {
              setIsSpeaking(false);
            },
          });
        }
      },
      // 错误时的回调
      (error: Error) => {
        setIsThinking(false);
        setIsSpeaking(false);
        console.error('AI 响应错误:', error);
        
        // AI 失败时，再次尝试本地匹配作为降级方案
        const fallbackMatch = findBestAnswer(text);
        if (fallbackMatch) {
          const fallbackMessage: Message = {
            id: (Date.now() + 2).toString(),
            content: fallbackMatch.answer,
            type: 'bot',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, fallbackMessage]);
          
          // 语音播报
          if (voiceEnabled && speechSynthesizerRef.current) {
            setIsSpeaking(true);
            speechSynthesizerRef.current.speak(fallbackMessage.content, {
              characterId: selectedCharacter.id,
              onEnd: () => {
                setIsSpeaking(false);
              },
            });
          }
        } else {
          toast.error('AI 服务暂时不可用');
        }
      }
    );
  };

  // 处理推荐问题点击
  const handleRecommendation = (question: string) => {
    handleSendMessage(question);
  };

  // 开始语音识别
  const handleStartListening = () => {
    // 防止重复启动
    if (isListening) {
      console.warn('⚠️ 语音识别已在进行中，忽略重复启动请求');
      return;
    }

    if (!speechRecognizerRef.current) {
      toast.error('您的浏览器不支持语音识别');
      return;
    }

    // 检查识别器是否已在监听
    if (speechRecognizerRef.current.getIsListening()) {
      console.warn('⚠️ 语音识别器已启动，忽略重复启动请求');
      return;
    }

    setIsListening(true);
    speechRecognizerRef.current.start(
      (text) => {
        setIsListening(false);
        handleSendMessage(text);
      },
      (error) => {
        setIsListening(false);
        toast.error(`语音识别失败: ${error}`);
      }
    );
  };

  // 停止语音识别
  const handleStopListening = () => {
    speechRecognizerRef.current?.stop();
    setIsListening(false);
  };

  // 统一的语音按钮处理函数
  const handleVoiceButton = () => {
    const now = Date.now();
    // 防止短时间内重复触发（防抖，300ms）
    if (now - lastTriggerTimeRef.current < 300) {
      console.warn('⚠️ 操作过于频繁，忽略本次请求');
      return;
    }
    lastTriggerTimeRef.current = now;
    
    if (isListening) {
      handleStopListening();
    } else {
      handleStartListening();
    }
  };

  // 处理触摸开始事件（移动端）
  const handleTouchStart = (e: React.TouchEvent) => {
    // 记录触摸时间，用于防止与点击事件重复触发
    setTouchStartTime(Date.now());
    handleVoiceButton();
  };

  // 处理点击事件（PC端和移动端备用）
  const handleClick = (e: React.MouseEvent) => {
    // 如果触摸事件刚刚触发过（300ms内），忽略点击事件，避免重复触发
    // 移动端通常会先触发 touchstart，然后触发 click，所以需要忽略后续的 click
    if (Date.now() - touchStartTime < 300) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    handleVoiceButton();
  };

  // 切换语音播报
  const toggleVoice = () => {
    const newVoiceEnabled = !voiceEnabled;
    setVoiceEnabled(newVoiceEnabled);
    
    // 如果正在关闭语音且当前正在播放，停止播放
    if (!newVoiceEnabled && isSpeaking && speechSynthesizerRef.current) {
      speechSynthesizerRef.current.stop();
      setIsSpeaking(false);
    }
  };

  // 切换人物
  const handleSwitchCharacter = () => {
    // 切换顾问时，先停止当前正在播放的语音
    stopCurrentSpeech();
    
    const currentIndex = characters.findIndex(c => c.id === selectedCharacter.id);
    const nextIndex = (currentIndex + 1) % characters.length;
    setSelectedCharacter(characters[nextIndex]);
  };

  const contactInfo = getContactInfo();

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden max-w-2xl mx-auto relative"
      style={{
        background: `linear-gradient(to bottom, ${hexToRgba(selectedCharacter.accentColor, 0.05)}, ${selectedCharacter.bgColor})`,
      }}
    >
      {/* 顶部角色信息 */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 flex items-center justify-between px-4 py-3 flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <img
            src={selectedCharacter.avatar}
            alt={selectedCharacter.name}
            className="w-12 h-12 rounded-full flex-shrink-0 object-cover border-2"
            style={{ borderColor: selectedCharacter.accentColor }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-gray-900">{selectedCharacter.name}</h1>
              <span className="text-xs text-gray-500">{selectedCharacter.title}</span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5 truncate">{selectedCharacter.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwitchCharacter}
            className="text-xs h-8 px-3 rounded-lg border-2 font-medium"
            style={{
              borderColor: selectedCharacter.accentColor,
              color: selectedCharacter.accentColor,
            }}
          >
            切换顾问
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVoice}
            className="rounded-full h-10 w-10"
            style={{ color: selectedCharacter.accentColor }}
          >
            {voiceEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* 主视觉：人物展示 - Lottie动画占满中间主体 */}
      <div className="flex-1 relative overflow-hidden m-0 p-0">
        <DotLottieReact
          src={
            isSpeaking
              ? selectedCharacter.animations.speaking
              : isThinking
              ? selectedCharacter.animations.thinking
              : isListening
              ? selectedCharacter.animations.listening
              : selectedCharacter.animations.idle
          }
          loop
          autoplay
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* 半透明固定消息区域 - 默认显示欢迎语和猜你想问 */}
      {visibleMessages.length > 0 && (
        <div className="absolute bottom-24 left-0 right-0 max-h-[45vh] z-30 px-4 pb-2">
          <div className="bg-transparent rounded-2xl overflow-hidden max-w-2xl mx-auto">
            <div
              ref={messageViewportRef}
              className="max-h-[45vh] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="p-4 space-y-4 pb-6">
                {/* 消息列表 - 只显示可见消息 */}
                {visibleMessages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    accentColor={selectedCharacter.accentColor}
                    accentBgColor={hexToRgba('#FFFFFF', 0.9)}
                    botAvatarUrl={selectedCharacter.avatar}
                  />
                ))}

                {/* 猜你想问 */}
                {smartRecommendations.length > 0 && (
                  <div className="mt-6 pt-4">
                    <p className="text-sm font-semibold text-gray-800 mb-3 drop-shadow-sm">
                      {visibleMessages.length <= 1 ? '快捷问题' : '猜你想问'}
                    </p>
                    <button
                      onClick={() => handleRecommendation(smartRecommendations[0].question)}
                      className="w-full p-3 text-left bg-white/90 backdrop-blur-sm rounded-lg border transition-all text-sm text-gray-700 hover:text-gray-900 hover:opacity-90 shadow-sm"
                      style={{ 
                        borderColor: selectedCharacter.accentColor,
                      }}
                    >
                      {smartRecommendations[0].question}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 底部输入框 */}
      <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-200/50 flex-shrink-0 z-20 shadow-lg">
        <div className="flex gap-2">
          <Input
            placeholder="输入您的问题..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              // 输入时设置聆听状态
              if (e.target.value.trim() && !isListening && !isThinking && !isSpeaking) {
                setIsListening(true);
              }
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                setIsListening(false);
                handleSendMessage(inputValue);
              }
            }}
            onBlur={() => {
              // 失去焦点时如果没有内容则取消聆听状态
              if (!inputValue.trim()) {
                setIsListening(false);
              }
            }}
            className="flex-1 bg-white/50 backdrop-blur-sm border-gray-200"
          />
          <Button
            variant="ghost"
            size="icon"
            onTouchStart={handleTouchStart}
            onClick={handleClick}
            className={`rounded-full ${isListening ? 'bg-red-100 text-red-600' : ''}`}
          >
            <Mic className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => {
              setIsListening(false);
              handleSendMessage(inputValue);
            }}
            className="rounded-full text-white hover:opacity-90 shadow-md"
            style={{ backgroundColor: selectedCharacter.accentColor }}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
