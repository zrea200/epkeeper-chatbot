/**
 * 百度语音服务配置
 * 
 * 获取方式：
 * 1. 访问百度AI开放平台：https://ai.baidu.com/
 * 2. 创建语音技术应用
 * 3. 获取 API Key 和 Secret Key
 */

export const BAIDU_SPEECH_CONFIG = {
  /**
   * 是否启用百度语音服务
   * false 将使用浏览器原生 Web Speech API（微信内不可用）
   */
  enabled: true,
  
  /**
   * 百度语音 API Key
   * 从百度AI开放平台获取
   */
  apiKey: '87nNlKH0xziFR1BAzx2REOT5',
  
  /**
   * 百度语音 Secret Key
   * 从百度AI开放平台获取
   */
  secretKey: '0H2nhQZbMaiTPz3oe9w1GLFdzOOXTLxu',
  
  /**
   * 语音识别配置
   */
  recognition: {
    // 语言，zh 表示中文
    language: 'zh',
    // 采样率，支持 8000 或 16000
    rate: 16000,
    // 格式，支持 pcm、wav、amr、m4a
    format: 'wav',
    // 声道数，仅支持单声道
    channel: 1,
  },
  
  /**
   * 语音合成配置
   */
  synthesis: {
    // 音量，取值 0-15，默认 5
    vol: 5,
    // 语速，取值 0-15，默认 5
    spd: 5,
    // 音调，取值 0-15，默认 5
    pit: 5,
    // 音色选择
    // 0-普通女声，1-普通男声，3-情感合成-度逍遥，4-情感合成-度丫丫
    per: 0,
    // 音频格式，3-mp3，4-pcm-16k，5-pcm-8k，6-wav
    aue: 6,
  },
};

export default BAIDU_SPEECH_CONFIG;

