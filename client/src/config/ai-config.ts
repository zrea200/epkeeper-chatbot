/**
 * AI 接口配置文件
 * 
 * 如需修改 AI 接口地址或授权信息，请在此文件中修改
 */

export const AI_CONFIG = {
  /**
   * Langcore API 地址
   */
  url: 'https://demo.langcore.cn/api/workflow/run/cmhafvsit003pmvc5228wtatt',
  
  /**
   * API 授权令牌
   */
  authorization: 'Bearer sk-zzvwbcaxoss3',
  
  /**
   * 是否启用 AI 功能
   * 设置为 false 将使用本地关键词匹配
   */
  enabled: true,
  
  /**
   * 请求超时时间（毫秒）
   */
  timeout: 30000,
};

export default AI_CONFIG;

