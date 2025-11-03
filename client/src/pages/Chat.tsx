import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatMessage, { Message } from '@/components/ChatMessage';
import Live2DModel from '@/components/Live2DModel';
import { 
  findBestAnswer, 
  getQuickQuestions,
  getContactInfo,
  getAIResponseStream,
} from '@/lib/qa-matcher';
import { getSmartRecommendations, Recommendation } from '@/lib/smart-recommendations';
import { characters, Character, getDefaultCharacter } from '@/data/characters';
import { SpeechRecognizer, SpeechSynthesizer } from '@/lib/speech';
import { toast } from 'sonner';
import { Volume2, VolumeX, Mic, Send, Eye, EyeOff } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import AI_CONFIG from '@/config/ai-config';

export default function Chat() {
  // 状态管理
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showMessages, setShowMessages] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(getDefaultCharacter());
  const [smartRecommendations, setSmartRecommendations] = useState<Recommendation[]>([]);

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
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const speechRecognizerRef = useRef<SpeechRecognizer | null>(null);
  const speechSynthesizerRef = useRef<SpeechSynthesizer | null>(null);

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

  // 自动滚动到底部
  useEffect(() => {
    if (scrollViewportRef.current && showMessages) {
      setTimeout(() => {
        const scrollElement = scrollViewportRef.current?.closest('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }
      }, 0);
    }
  }, [messages, showMessages]);

  // 处理发送消息（支持 AI 流式响应和本地匹配）
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

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

    // 如果 AI 功能未启用，使用本地关键词匹配
    if (!AI_CONFIG.enabled) {
      setTimeout(() => {
        const result = findBestAnswer(text);
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: result?.answer || '抱歉，我没有找到相关答案。请拨打我们的服务热线：4006139090',
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
            onEnd: () => {
              setIsSpeaking(false);
            },
          });
        }
      }, 800);
      return;
    }

    // 使用 AI 流式响应
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

    // 调用 AI 流式接口
    getAIResponseStream(
      text,
      // 收到数据块时的回调（chunk 是累积的完整文本）
      (chunk: string) => {
        setIsThinking(false);
        setIsSpeaking(true);
        fullResponse = chunk; // 直接使用传入的完整文本
        
        // 更新消息内容
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
        toast.error('AI 服务暂时不可用，已切换到本地问答模式');
      }
    );
  };

  // 处理推荐问题点击
  const handleRecommendation = (question: string) => {
    handleSendMessage(question);
  };

  // 开始语音识别
  const handleStartListening = () => {
    if (!speechRecognizerRef.current) {
      toast.error('您的浏览器不支持语音识别');
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

  // 切换语音播报
  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
  };

  // 切换消息显示
  const toggleShowMessages = () => {
    setShowMessages(!showMessages);
  };

  // 切换人物
  const handleSwitchCharacter = () => {
    const currentIndex = characters.findIndex(c => c.id === selectedCharacter.id);
    const nextIndex = (currentIndex + 1) % characters.length;
    setSelectedCharacter(characters[nextIndex]);
  };

  const contactInfo = getContactInfo();

  return (
    <div
      className="h-screen w-full bg-white flex flex-col overflow-hidden max-w-2xl mx-auto"
    >
      {/* 头部 */}
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img
            src={selectedCharacter.avatar}
            alt={selectedCharacter.name}
            className="w-12 h-12 rounded-full flex-shrink-0 object-cover"
          />
          <div>
            <h1 className="text-base font-bold text-gray-900">{selectedCharacter.name}</h1>
            <p className="text-xs text-gray-500">在线</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleShowMessages}
            className="rounded-full h-10 w-10"
            style={{ color: selectedCharacter.accentColor }}
          >
            {showMessages ? (
              <Eye className="w-5 h-5" />
            ) : (
              <EyeOff className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!showMessages ? (
          // 默认状态：显示头像和人物信息
          <div className={`flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b ${selectedCharacter.bgColor}`}>
            <div className="text-center space-y-6 w-full max-w-md mx-auto">
              {/* Lottie 动画展示 */}
              <div
                className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border-4 flex items-center justify-center"
                style={{ borderColor: selectedCharacter.accentColor }}
              >
                <DotLottieReact
                  src={
                    isSpeaking
                      ? "/3D Chef Dancing.json"  // AI说话状态
                      : isThinking
                      ? "/Spin.json"              // 思考状态
                      : isListening
                      ? "/Meditating Tiger.json"  // 聆听状态
                      : "/Meditating Tiger.json"  // 默认状态
                  }
                  loop
                  autoplay
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

              {/* 人物信息 */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedCharacter.name}</h2>
                <p className="text-sm text-gray-600 mt-2">{selectedCharacter.description}</p>
              </div>

              {/* 切换顾问按钮 */}
              <Button
                onClick={handleSwitchCharacter}
                variant="outline"
                className="w-48 h-12 rounded-lg border-2 font-medium hover:bg-gray-50"
                style={{
                  borderColor: selectedCharacter.accentColor,
                  color: selectedCharacter.accentColor,
                }}
              >
                切换顾问
              </Button>
            </div>
          </div>
        ) : (
          // 消息显示状态
          <ScrollArea className="flex-1 overflow-hidden">
            <div className="p-4 space-y-4" ref={scrollViewportRef}>
              {/* 消息列表 */}
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  accentColor={selectedCharacter.accentColor}
                  accentBgColor={hexToRgba(selectedCharacter.accentColor, 0.1)}
                  botAvatarUrl={selectedCharacter.avatar}
                />
              ))}

              {/* 推荐问题区域 */}
              {smartRecommendations.length > 0 && messages.length > 1 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {messages.length <= 2 ? '快捷问题' : '猜你想问'}
                  </p>
                  <div className="space-y-2">
                    {smartRecommendations.map((rec, index) => (
                      <button
                        key={index}
                        onClick={() => handleRecommendation(rec.question)}
                        className={`w-full p-3 text-left bg-gradient-to-r rounded-lg border transition-all text-sm text-gray-700 hover:text-gray-900 hover:opacity-90 ${selectedCharacter.bgColor}`}
                        style={{ borderColor: selectedCharacter.accentColor }}
                      >
                        {rec.question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* 底部信息 */}
      <div className="px-4 py-2 text-center text-xs text-gray-500 border-t border-gray-200 flex-shrink-0">
        电管家集团 · 服务热线: {contactInfo?.phone}
      </div>

      {/* 输入区域 */}
      <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
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
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={
              isListening ? handleStopListening : handleStartListening
            }
            className={`rounded-full ${isListening ? 'bg-red-100 text-red-600' : ''}`}
          >
            <Mic className="w-5 h-5" />
          </Button>
          <Button
            onClick={() => {
              setIsListening(false);
              handleSendMessage(inputValue);
            }}
            className="rounded-full text-white hover:opacity-90"
            style={{ backgroundColor: selectedCharacter.accentColor }}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
