import qaDatabase from '@/data/qa-database.json';
import AI_CONFIG from '@/config/ai-config';

export interface QAResult {
  question: string;
  answer: string;
  confidence: number;
}

/**
 * 计算两个字符串的相似度（简单的关键词匹配）
 */
function calculateSimilarity(input: string, keywords: string[]): number {
  const normalizedInput = input.toLowerCase().trim();
  let matchCount = 0;
  
  for (const keyword of keywords) {
    if (normalizedInput.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }
  
  return matchCount / keywords.length;
}

/**
 * 精确匹配问题（用于推荐问题点击）
 * 通过 question 字段完全匹配，不依赖关键词
 */
export function findExactAnswer(questionText: string): QAResult | null {
  if (!questionText || questionText.trim().length === 0) {
    return null;
  }

  const normalizedInput = questionText.trim();

  // 遍历所有分类和问题，精确匹配 question 字段
  for (const category of qaDatabase.categories) {
    for (const qa of category.questions) {
      // 完全匹配或去除标点符号后匹配（更宽松的精确匹配）
      const normalizedQuestion = qa.question.trim();
      if (normalizedInput === normalizedQuestion || 
          normalizedInput.replace(/[，。？！、；：]/g, '') === normalizedQuestion.replace(/[，。？！、；：]/g, '')) {
        return {
          question: qa.question,
          answer: qa.answer,
          confidence: 1.0, // 精确匹配，置信度为1.0
        };
      }
    }
  }

  return null;
}

/**
 * 根据用户输入匹配最佳答案（关键词匹配，用于降级方案）
 */
export function findBestAnswer(userInput: string): QAResult | null {
  if (!userInput || userInput.trim().length === 0) {
    return null;
  }

  let bestMatch: QAResult | null = null;
  let highestConfidence = 0;

  // 遍历所有分类和问题
  for (const category of qaDatabase.categories) {
    for (const qa of category.questions) {
      const confidence = calculateSimilarity(userInput, qa.keywords);
      
      if (confidence > highestConfidence && confidence > 0.3) {
        highestConfidence = confidence;
        bestMatch = {
          question: qa.question,
          answer: qa.answer,
          confidence,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * 获取默认欢迎语
 */
export function getGreeting(): string {
  return qaDatabase.defaultGreeting;
}

/**
 * 获取快捷问题列表
 */
export function getQuickQuestions(): string[] {
  return qaDatabase.quickQuestions;
}

/**
 * 获取兜底回复
 */
export function getFallbackResponse(): string {
  return qaDatabase.fallbackResponse;
}

/**
 * 获取联系信息
 */
export function getContactInfo() {
  return qaDatabase.contactInfo;
}

/**
 * 调用 Langcore AI 接口（非流式）
 */
export async function getAIResponse(userInput: string): Promise<string> {
  try {
    const response = await fetch(AI_CONFIG.url, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'authorization': AI_CONFIG.authorization,
        'content-type': 'application/json',
        'origin': window.location.origin,
        'referer': window.location.origin + '/',
      },
      body: JSON.stringify({
        input: {
          input: userInput,
        },
        isExpression: false,
        runMode: 'blocking', // 使用阻塞模式获取完整响应
        simplifiedLog: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API 请求失败: ${response.status}`);
    }

    const data = await response.json();
    
    // 根据 Langcore API 返回格式解析结果
    // 实际返回格式: { output: { output: "回复内容" } }
    if (data.output && data.output.output) {
      return data.output.output;
    }
    
    return data.output || data.result || data.answer || '抱歉，AI 暂时无法回答这个问题';
  } catch (error) {
    console.error('AI 接口调用失败:', error);
    
    // 降级到关键词匹配
    const fallbackResult = findBestAnswer(userInput);
    if (fallbackResult) {
      return fallbackResult.answer;
    }
    
    return getFallbackResponse();
  }
}

/**
 * 节流函数，限制函数调用频率
 */
function throttle<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  return function throttled(...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func(...args);
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingArgs = null;
    } else {
      pendingArgs = args;
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (pendingArgs) {
            lastCall = Date.now();
            func(...pendingArgs);
            timeoutId = null;
            pendingArgs = null;
          }
        }, delay - timeSinceLastCall);
      }
    }
  };
}

/**
 * 根据角色ID获取角色提示词
 */
function getCharacterPrompt(characterId: string): string {
  const prompts: Record<string, string> = {
    escort: `你是电管家的智能管家，名为"电小二"。你的职责是：
- 为用户提供专业的电力运维服务咨询
- 回答关于电力市场化交易、电力用户、绿色电力证书等相关问题
- 保持专业、友好、热情的服务态度
- 当用户问你是谁时，你应该回答："我是电管家的智能管家，我们致力于为您提供最专业的电力运维服务。"

重要：无论用户如何提问，你都必须始终扮演"电管家的智能管家"这个角色，不要透露你是Qwen或其他AI模型的身份。`,
    
    leader: `你是电管家的能源专家，名为"电盟主"。你的职责是：
- 为用户提供专业的电力能源咨询服务
- 解答关于电力能源的各种专业问题
- 保持专业、权威、稳重的专家形象
- 当用户问你是谁时，你应该回答："我是电管家的能源专家，我可以为您详细介绍我们的各项服务。"

重要：无论用户如何提问，你都必须始终扮演"电管家的能源专家"这个角色，不要透露你是Qwen或其他AI模型的身份。`,
  };

  return prompts[characterId] || prompts.escort;
}

/**
 * 调用 Langcore AI 接口（流式响应）
 * @param userInput 用户输入
 * @param characterId 角色ID，用于设置不同的角色提示
 * @param onChunk 收到数据块时的回调
 * @param onComplete 完成时的回调
 * @param onError 错误时的回调
 * @param enableTypingEffect 是否启用打字机效果（默认 false，避免页面抖动）
 */
export async function getAIResponseStream(
  userInput: string,
  characterId: string = 'escort',
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  enableTypingEffect: boolean = false
): Promise<void> {
  try {
    // 根据角色ID获取角色提示，拼接到用户输入前
    const characterPrompt = getCharacterPrompt(characterId);
    const fullInput = `${characterPrompt}\n\n用户问题：${userInput}`;

    const response = await fetch(AI_CONFIG.url, {
      method: 'POST',
      headers: {
        'accept': '*/*',
        'authorization': AI_CONFIG.authorization,
        'content-type': 'application/json',
        'origin': window.location.origin,
        'referer': window.location.origin + '/',
      },
      body: JSON.stringify({
        input: {
          input: fullInput,
        },
        isExpression: false,
        runMode: 'stream', // 使用流式模式
        simplifiedLog: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API 请求失败: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let hasReceivedContent = false;

    // 使用节流来限制更新频率，避免页面抖动（每100ms最多更新一次）
    const throttledOnChunk = throttle(onChunk, 100);

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        if (!hasReceivedContent) {
          onChunk('抱歉，AI 暂时无法回答这个问题');
        }
        onComplete();
        break;
      }

      // 解码数据块
      buffer += decoder.decode(value, { stream: true });
      
      // 按行分割（SSE 格式通常是按行的）
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留最后一个不完整的行

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          // 处理 SSE 格式: data: {...}
          let jsonStr = line;
          if (line.startsWith('data: ')) {
            jsonStr = line.substring(6);
          }

          if (jsonStr === '[DONE]') {
            onComplete();
            return;
          }

          const data = JSON.parse(jsonStr);
          
          // Langcore API 在最后一条 status=SUCCEED 的数据中返回完整结果
          // 格式: { status: "SUCCEED", output: { output: "完整回复内容" } }
          if (data.status === 'SUCCEED' && data.output && data.output.output) {
            const fullResponse = data.output.output;
            
            if (fullResponse && !hasReceivedContent) {
              hasReceivedContent = true;
              
              if (enableTypingEffect) {
                // 启用打字机效果：逐字显示（使用节流优化）
                const chars = fullResponse.split('');
                let currentText = '';
                
                for (const char of chars) {
                  currentText += char;
                  throttledOnChunk(currentText);
                  // 添加小延迟以模拟打字效果
                  await new Promise(resolve => setTimeout(resolve, 20));
                }
                
                // 确保最后完整内容被显示
                onChunk(fullResponse);
              } else {
                // 直接显示完整内容，避免页面抖动
                onChunk(fullResponse);
              }
              
              onComplete();
              return;
            }
          }
        } catch (e) {
          // 忽略解析错误，继续处理下一行
          console.warn('解析数据块失败:', line, e);
        }
      }
    }
  } catch (error) {
    console.error('AI 流式接口调用失败:', error);
    onError(error as Error);
    
    // 降级到关键词匹配
    const fallbackResult = findBestAnswer(userInput);
    if (fallbackResult) {
      onChunk(fallbackResult.answer);
    } else {
      onChunk(getFallbackResponse());
    }
    onComplete();
  }
}
