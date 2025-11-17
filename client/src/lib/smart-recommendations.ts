import qaDatabase from '@/data/qa-database.json';

export interface Recommendation {
  question: string;
  category: string;
}

/**
 * 基于用户最后一条消息和 AI 回复，推荐相关问题
 * 改进：遍历所有问题，确保每个问题都有机会被推荐，降低重复率
 */
export function getSmartRecommendations(
  userMessage: string,
  aiResponse: string,
  previousRecommendations: string[] = []
): Recommendation[] {
  const usedQuestions = new Set(previousRecommendations);
  const allAvailableQuestions: Recommendation[] = [];

  // 遍历所有问题，收集可用的问题
  for (const category of qaDatabase.categories) {
    for (const qa of category.questions) {
      // 排除最近推荐过的问题
      if (!usedQuestions.has(qa.question)) {
        allAvailableQuestions.push({
          question: qa.question,
          category: category.name,
        });
      }
    }
  }

  // 如果没有可用问题，返回空数组
  if (allAvailableQuestions.length === 0) {
    return [];
  }

  // 如果可用问题少于等于3个，直接返回
  if (allAvailableQuestions.length <= 3) {
    return allAvailableQuestions;
  }

  // 随机打乱并选择3个问题
  const shuffled = [...allAvailableQuestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * 从用户消息和 AI 回复中提取关键词
 */
function extractKeywords(userMessage: string, aiResponse: string): string[] {
  const keywords: string[] = [];

  // 常见关键词列表
  const keywordPatterns: string[] = [
    '售电',
    '绿电',
    '储能',
    '虚拟电厂',
    '微电网',
    '需求响应',
    '电力',
    '能源',
    '市场',
    '交易',
    '系统',
    '运维',
    '服务',
  ];

  const combinedText = `${userMessage}${aiResponse}`.toLowerCase();

  for (const pattern of keywordPatterns) {
    if (combinedText.includes(pattern)) {
      keywords.push(pattern);
    }
  }

  return keywords.length > 0 ? keywords : ['电力', '服务'];
}

/**
 * 获取随机推荐问题
 */
function getRandomQuestions(
  count: number,
  excludeQuestions: Set<string>
): Recommendation[] {
  const allQuestions: Recommendation[] = [];

  for (const category of qaDatabase.categories) {
    for (const qa of category.questions) {
      if (!excludeQuestions.has(qa.question)) {
        allQuestions.push({
          question: qa.question,
          category: category.name,
        });
      }
    }
  }

  // 随机打乱
  const shuffled = allQuestions.sort(() => Math.random() - 0.5);

  return shuffled.slice(0, Math.min(count, shuffled.length));
}
