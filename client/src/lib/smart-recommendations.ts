import qaDatabase from '@/data/qa-database.json';

export interface Recommendation {
  question: string;
  category: string;
}

/**
 * 基于用户最后一条消息和 AI 回复，推荐相关问题
 */
export function getSmartRecommendations(
  userMessage: string,
  aiResponse: string,
  previousRecommendations: string[] = []
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const usedQuestions = new Set(previousRecommendations);

  // 提取关键词
  const keywords = extractKeywords(userMessage, aiResponse);

  // 根据关键词查找相关问题
  for (const keyword of keywords) {
    for (const category of qaDatabase.categories) {
      for (const qa of category.questions) {
        // 检查是否已推荐过
        if (usedQuestions.has(qa.question)) continue;

        // 检查问题是否包含关键词
        const questionText = qa.question.toLowerCase();
        const keywordLower = keyword.toLowerCase();

        if (
          questionText.includes(keywordLower) ||
          qa.keywords.some((k: string) => k.toLowerCase().includes(keywordLower))
        ) {
          recommendations.push({
            question: qa.question,
            category: category.name,
          });
          usedQuestions.add(qa.question);

          if (recommendations.length >= 3) break;
        }
      }
      if (recommendations.length >= 3) break;
    }
    if (recommendations.length >= 3) break;
  }

  // 如果没有找到足够的推荐，返回随机问题
  if (recommendations.length < 3) {
    const randomQuestions = getRandomQuestions(3 - recommendations.length, usedQuestions);
    recommendations.push(...randomQuestions);
  }

  return recommendations.slice(0, 3);
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
