import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
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
import { characters, Character, getDefaultCharacter, getCharacterById } from '@/data/characters';
import { SpeechRecognizer, SpeechSynthesizer } from '@/lib/speech';
import { toast } from 'sonner';
import { Volume2, VolumeX, Mic, Send } from 'lucide-react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import AI_CONFIG from '@/config/ai-config';

export default function Chat() {
  const [location] = useLocation();
  
  // 根据URL参数初始化角色（如果有NFC参数）
  const getInitialCharacter = (): Character => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const avatar = params.get('avatar');
      if (avatar) {
        const characterId = avatar === '电盟主' ? 'leader' : 'escort';
        const character = getCharacterById(characterId);
        if (character) {
          return character;
        }
      }
    }
    return getDefaultCharacter();
  };
  
  // 状态管理
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]); // 可见的消息列表
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(getInitialCharacter());
  const [smartRecommendations, setSmartRecommendations] = useState<Recommendation[]>([]);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [nfcInitialized, setNfcInitialized] = useState(false); // 标记NFC是否已初始化
  const [nfcContext, setNfcContext] = useState<{ point: number; avatar: string } | null>(null); // NFC上下文状态
  const [currentNFCQuestionIndex, setCurrentNFCQuestionIndex] = useState<number>(0); // 当前NFC问题索引，用于循环推荐

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

  // 获取NFC推荐问题（从当前点位的问题列表中循环获取）
  const getNFCRecommendations = async (point: number, avatar: string, currentQuestionIndex: number): Promise<{ question: string | null; nextIndex: number }> => {
    try {
      // 通过API获取NFC数据
      const response = await fetch(`/api/nfc-data?point=${point}&avatar=${encodeURIComponent(avatar)}`);
      if (!response.ok) {
        console.error('[Chat] 获取NFC数据失败:', response.status);
        return { question: null, nextIndex: currentQuestionIndex };
      }
      const data = await response.json();
      
      if (data.pointData && data.pointData.questions && data.pointData.questions.length > 0) {
        // 循环获取下一个问题
        const nextIndex = (currentQuestionIndex + 1) % data.pointData.questions.length;
        return {
          question: data.pointData.questions[nextIndex].question,
          nextIndex,
        };
      }
      return { question: null, nextIndex: currentQuestionIndex };
    } catch (error) {
      console.error('[Chat] 获取NFC推荐问题失败:', error);
      return { question: null, nextIndex: currentQuestionIndex };
    }
  };

  // 初始化NFC场景（通过URL参数）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const point = params.get('point');
    const avatar = params.get('avatar');
    const question = params.get('question');

    // 如果URL中有NFC参数，则初始化NFC场景
    if (point && avatar && question) {
      const pointNum = parseInt(point);
      console.log('[Chat] NFC场景初始化:', { point: pointNum, avatar, question });
      
      // 保存NFC上下文到状态中
      setNfcContext({ point: pointNum, avatar });
      
      // 初始化语音识别和合成（NFC场景也需要）
      if (!speechRecognizerRef.current) {
        speechRecognizerRef.current = new SpeechRecognizer();
      }
      if (!speechSynthesizerRef.current) {
        speechSynthesizerRef.current = new SpeechSynthesizer();
      }
      
      // 根据avatar设置角色（确保角色已正确设置）
      const characterId = avatar === '电盟主' ? 'leader' : 'escort';
      const character = getCharacterById(characterId);
      if (character) {
        console.log('[Chat] 确保角色正确:', character.name);
        // 使用函数式更新确保角色正确
        setSelectedCharacter((prev) => {
          if (prev.id !== character.id) {
            return character;
          }
          return prev;
        });
      }

      // 调用NFC接口获取第一个问题的答案
      fetch(`/api/nfc?point=${encodeURIComponent(point)}&avatar=${encodeURIComponent(avatar)}&question=${encodeURIComponent(question)}`)
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error_description || `请求失败: ${res.status}`);
          }
          return res.json();
        })
        .then(async (result: { success: boolean; point: number; avatar: string; question: string; answer: string; nextQuestion: string }) => {
          console.log('[Chat] NFC接口返回:', result);
          
          // 查找当前问题在NFC数据中的索引
          try {
            const nfcDataRes = await fetch(`/api/nfc-data?point=${pointNum}&avatar=${encodeURIComponent(avatar)}`);
            if (nfcDataRes.ok) {
              const nfcData = await nfcDataRes.json();
              if (nfcData.pointData && nfcData.pointData.questions) {
                const normalizeQuestion = (q: string) => {
                  return q.replace(/[，。？！、；：\s]/g, '').toLowerCase().trim();
                };
                const normalizedInput = normalizeQuestion(question);
                const questionIndex = nfcData.pointData.questions.findIndex(
                  (q: any) => {
                    const normalizedQ = normalizeQuestion(q.question);
                    return q.question === question || normalizedQ === normalizedInput;
                  }
                );
                if (questionIndex !== -1) {
                  setCurrentNFCQuestionIndex(questionIndex);
                }
              }
            }
          } catch (err) {
            console.error('[Chat] 获取NFC问题索引失败:', err);
          }
          
          // 创建用户消息
          const userMessage: Message = {
            id: Date.now().toString(),
            content: result.question,
            type: 'user',
            timestamp: new Date(),
          };

          // 创建AI回答消息
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: result.answer,
            type: 'bot',
            timestamp: new Date(),
          };

          setMessages([userMessage, botMessage]);

          // 设置推荐问题（使用返回的nextQuestion）
          if (result.nextQuestion) {
            setSmartRecommendations([{
              question: result.nextQuestion,
              category: '猜你想问',
            }]);
          }

          // NFC场景下不自动播放语音（浏览器自动播放策略限制）
          // 用户可以通过点击语音按钮手动播放
          // 语音播报功能保留，但不自动触发
        })
        .catch((err) => {
          console.error('NFC接口调用失败:', err);
          toast.error('加载失败', {
            description: err.message || '请稍后重试',
          });
        });
      
      return; // NFC场景不执行常规初始化
    }

    // 常规初始化（非NFC场景）- 只在首次加载时执行
    if (!nfcInitialized && !point && !avatar && !question) {
      setNfcInitialized(true);
      
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
    }
  }, [location, selectedCharacter.greeting]); // location变化时重新执行，selectedCharacter.greeting用于常规初始化

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

    // NFC场景：优先从NFC数据中查找答案
    if (nfcContext) {
      // 调用NFC接口查找答案
      fetch(`/api/nfc?point=${encodeURIComponent(nfcContext.point)}&avatar=${encodeURIComponent(nfcContext.avatar)}&question=${encodeURIComponent(text)}`)
        .then(async (res) => {
          if (res.ok) {
            const result = await res.json();
            // NFC数据中有答案，使用NFC答案
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              content: result.answer,
              type: 'bot',
              timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setIsThinking(false);

            // 更新问题索引并获取推荐问题
            let updatedIndex = currentNFCQuestionIndex;
            try {
              const nfcDataRes = await fetch(`/api/nfc-data?point=${nfcContext.point}&avatar=${encodeURIComponent(nfcContext.avatar)}`);
              if (nfcDataRes.ok) {
                const nfcData = await nfcDataRes.json();
                if (nfcData.pointData && nfcData.pointData.questions) {
                  const normalizeQuestion = (q: string) => {
                    return q.replace(/[，。？！、；：\s]/g, '').toLowerCase().trim();
                  };
                  const normalizedInput = normalizeQuestion(text);
                  const questionIndex = nfcData.pointData.questions.findIndex(
                    (q: any) => {
                      const normalizedQ = normalizeQuestion(q.question);
                      return q.question === text || normalizedQ === normalizedInput;
                    }
                  );
                  if (questionIndex !== -1) {
                    updatedIndex = questionIndex;
                    setCurrentNFCQuestionIndex(questionIndex);
                  }
                }
              }
            } catch (err) {
              console.error('[Chat] 获取NFC问题索引失败:', err);
            }

            // 更新推荐问题（使用更新后的索引）
            getNFCRecommendations(nfcContext.point, nfcContext.avatar, updatedIndex)
              .then((recResult) => {
                if (recResult.question) {
                  setCurrentNFCQuestionIndex(recResult.nextIndex);
                  setSmartRecommendations([{
                    question: recResult.question,
                    category: '猜你想问',
                  }]);
                }
              })
              .catch((err) => {
                console.error('[Chat] 获取NFC推荐问题失败:', err);
              });

            // 语音播报
            if (voiceEnabled && speechSynthesizerRef.current) {
              setIsSpeaking(true);
              speechSynthesizerRef.current.speak(assistantMessage.content, {
                characterId: selectedCharacter.id,
                onEnd: () => {
                  setIsSpeaking(false);
                },
                onError: (error) => {
                  console.error('语音播报失败:', error);
                  setIsSpeaking(false);
                },
              }).catch((error) => {
                console.error('语音播报调用失败:', error);
                setIsSpeaking(false);
              });
            }
            return; // NFC场景找到答案，直接返回
          } else {
            // NFC数据中没有找到答案，继续后续流程（检查qa-database或调用AI）
            handleNonNFCAnswer(text);
          }
        })
        .catch((err) => {
          console.error('[Chat] NFC接口调用失败:', err);
          // NFC接口调用失败，继续后续流程
          handleNonNFCAnswer(text);
        });
      return; // NFC场景下，无论是否找到答案，都在上面的回调中处理
    }

    // 非NFC场景：常规处理流程
    handleNonNFCAnswer(text);
  };

  // 处理非NFC场景的答案查找（qa-database匹配或AI调用）
  const handleNonNFCAnswer = (text: string) => {
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

        // NFC场景：更新推荐问题为NFC推荐问题
        if (nfcContext) {
          getNFCRecommendations(nfcContext.point, nfcContext.avatar, currentNFCQuestionIndex)
            .then((result) => {
              if (result.question) {
                setCurrentNFCQuestionIndex(result.nextIndex);
                setSmartRecommendations([{
                  question: result.question,
                  category: '猜你想问',
                }]);
              }
            })
            .catch((err) => {
              console.error('[Chat] 获取NFC推荐问题失败:', err);
            });
        } else {
          // 常规场景：获取智能推荐
          const recommendations = getSmartRecommendations(
            text,
            assistantMessage.content,
            messages.map((m) => m.content)
          );
          setSmartRecommendations(recommendations);
        }

        // 语音播报
        if (voiceEnabled && speechSynthesizerRef.current) {
          setIsSpeaking(true);
          speechSynthesizerRef.current.speak(assistantMessage.content, {
            characterId: selectedCharacter.id,
            onEnd: () => {
              setIsSpeaking(false);
            },
            onError: (error) => {
              console.error('语音播报失败:', error);
              setIsSpeaking(false);
            },
          }).catch((error) => {
            console.error('语音播报调用失败:', error);
            setIsSpeaking(false);
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

        // NFC场景：更新推荐问题为NFC推荐问题
        if (nfcContext) {
          getNFCRecommendations(nfcContext.point, nfcContext.avatar, currentNFCQuestionIndex)
            .then((result) => {
              if (result.question) {
                setCurrentNFCQuestionIndex(result.nextIndex);
                setSmartRecommendations([{
                  question: result.question,
                  category: '猜你想问',
                }]);
              }
            })
            .catch((err) => {
              console.error('[Chat] 获取NFC推荐问题失败:', err);
            });
        } else {
          // 常规场景：获取智能推荐
          const recommendations = getSmartRecommendations(
            text,
            assistantMessage.content,
            messages.map((m) => m.content)
          );
          setSmartRecommendations(recommendations);
        }

        // 语音播报
        if (voiceEnabled && speechSynthesizerRef.current) {
          setIsSpeaking(true);
          speechSynthesizerRef.current.speak(assistantMessage.content, {
            characterId: selectedCharacter.id,
            onEnd: () => {
              setIsSpeaking(false);
            },
            onError: (error) => {
              console.error('语音播报失败:', error);
              setIsSpeaking(false);
            },
          }).catch((error) => {
            console.error('语音播报调用失败:', error);
            setIsSpeaking(false);
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

        // NFC场景：更新推荐问题为NFC推荐问题
        if (nfcContext) {
          getNFCRecommendations(nfcContext.point, nfcContext.avatar, currentNFCQuestionIndex)
            .then((result) => {
              if (result.question) {
                setCurrentNFCQuestionIndex(result.nextIndex);
                setSmartRecommendations([{
                  question: result.question,
                  category: '猜你想问',
                }]);
              }
            })
            .catch((err) => {
              console.error('[Chat] 获取NFC推荐问题失败:', err);
            });
        } else {
          // 常规场景：获取智能推荐
          const recommendations = getSmartRecommendations(
            text,
            fullResponse,
            messages.map((m) => m.content)
          );
          setSmartRecommendations(recommendations);
        }

          // 语音播报完整内容
          if (voiceEnabled && speechSynthesizerRef.current && fullResponse) {
            setIsSpeaking(true);
            speechSynthesizerRef.current.speak(fullResponse, {
              characterId: selectedCharacter.id,
              onEnd: () => {
                setIsSpeaking(false);
              },
              onError: (error) => {
                console.error('语音播报失败:', error);
                setIsSpeaking(false);
              },
            }).catch((error) => {
              console.error('语音播报调用失败:', error);
              setIsSpeaking(false);
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
              onError: (error) => {
                console.error('语音播报失败:', error);
                setIsSpeaking(false);
              },
            }).catch((error) => {
              console.error('语音播报调用失败:', error);
              setIsSpeaking(false);
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
    // NFC场景和常规场景都直接发送消息，不再刷新页面
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
    // NFC场景下不允许切换顾问，因为问题和答案都是针对特定avatar的
    if (nfcContext) {
      toast.info('当前场景下无法切换顾问', {
        description: '当前场景已固定角色，请退出当前场景后再切换',
      });
      return;
    }
    
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
            disabled={!!nfcContext}
            className="text-xs h-8 px-3 rounded-lg border-2 font-medium"
            style={{
              borderColor: selectedCharacter.accentColor,
              color: selectedCharacter.accentColor,
              opacity: nfcContext ? 0.5 : 1,
              cursor: nfcContext ? 'not-allowed' : 'pointer',
            }}
            title={nfcContext ? 'NFC场景下无法切换顾问' : '切换顾问'}
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
