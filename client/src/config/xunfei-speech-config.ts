/**
 * 讯飞语音服务配置
 * 
 * 获取方式：
 * 1. 访问讯飞开放平台：https://www.xfyun.cn/
 * 2. 创建语音应用
 * 3. 获取 AppID、APIKey、APISecret
 */

export const XUNFEI_SPEECH_CONFIG = {
  /**
   * 是否启用讯飞语音服务
   * ⚠️ 必须设置为 true，因为已移除浏览器原生 API 支持
   */
  enabled: true,
  
  /**
   * ⚠️ 注意：前端不直接使用 API 密钥
   * 所有语音请求都通过后端代理（/api/asr/xunfei 和 /api/tts/xunfei）
   * API 密钥只在后端环境变量中配置（XUNFEI_APP_ID、XUNFEI_API_KEY、XUNFEI_API_SECRET）
   */
  
  /**
   * 语音识别配置
   */
  recognition: {
    // 语言，zh_cn 表示中文
    language: 'zh_cn',
    // 采样率，支持 16000
    rate: 16000,
    // 格式，支持 raw、wav、pcm
    format: 'wav',
    // 声道数，仅支持单声道
    channel: 1,
  },
  
  /**
   * 角色音色配置
   * 每个角色可以配置不同的音色参数
   */
  characterVoices: {
    /**
     * 电盟主 - 稳重男声
     * 代表公司整体形象，角色稳重
     */
    leader: {
      // 音色：讯飞小宇（男声，青年男声，基础发音人，通常已授权）
      vcn: 'xiaoyu', // 讯飞小宇-青年男声
      // 语速：稍慢（50-200，默认50）
      speed: 50,
      // 音调：标准（0-100，默认50）
      pitch: 50,
      // 音量：标准（0-100，默认50）
      volume: 50,
      // 音频格式：mp3（lame 编码，浏览器兼容性最佳）
      aue: 'lame',
    },
    
    /**
     * 电小二 - 轻快男声
     * 代表公司营销团队，偏向营销类资料，角色轻快
     */
    escort: {
      // 音色：讯飞小宇（男声，青年男声，基础发音人，通常已授权）
      vcn: 'xiaoyu', // 讯飞小宇-青年男声，通过调整语速和音调实现轻快效果
      // 语速：较快（50-200，默认50）
      speed: 70,
      // 音调：稍高（0-100，默认50）
      pitch: 60,
      // 音量：标准（0-100，默认50）
      volume: 50,
      // 音频格式：mp3（lame 编码，浏览器兼容性最佳）
      aue: 'lame',
    },
  },
};

export default XUNFEI_SPEECH_CONFIG;

