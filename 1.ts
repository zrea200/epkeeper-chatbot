import axios from 'axios';

/**
 * 百度语音API核心模块
 * 
 * 功能：
 * - Token自动管理和缓存
 * - QPS限制控制（防止触发频率限制）
 * - 自动重试机制（处理QPS限制错误）
 * - 语音识别（ASR）
 * - 语音合成（TTS）
 * 
 * 使用方式：
 * ```typescript
 * import { BaiduSpeechAPI } from './baidu-speech-api';
 * 
 * const api = new BaiduSpeechAPI({
 *   apiKey: 'your-api-key',
 *   secretKey: 'your-secret-key',
 *   minRequestInterval: 2500, // 可选，默认2500ms
 *   cuid: 'your-app-id' // 可选，用于标识应用
 * });
 * 
 * // 语音识别
 * const text = await api.speechToText(audioBuffer, 'wav', 16000);
 * 
 * // 语音合成
 * const audioBuffer = await api.textToSpeech('你好世界');
 * ```
 */

export interface BaiduSpeechConfig {
  /** 百度API Key（必需） */
  apiKey: string;
  /** 百度Secret Key（必需） */
  secretKey: string;
  /** 最小请求间隔（毫秒），默认2500ms，建议 >= 2500 以避免QPS限制 */
  minRequestInterval?: number;
  /** 应用标识，默认 'baidu-speech-api' */
  cuid?: string;
  /** 是否启用日志，默认 true */
  enableLog?: boolean;
}

export interface TTSOptions {
  /** 语速 0-15，默认5 */
  spd?: number;
  /** 音调 0-15，默认5 */
  pit?: number;
  /** 音量 0-15，默认5 */
  vol?: number;
  /** 发音人 0=度小美，1=度小宇，3=度逍遥，4=度丫丫，默认0 */
  per?: number;
}

export class BaiduSpeechAPI {
  private apiKey: string;
  private secretKey: string;
  private minRequestInterval: number;
  private cuid: string;
  private enableLog: boolean;

  // Token缓存
  private cachedToken: string | null = null;
  private tokenExpireTime: number = 0;

  // 请求频率控制
  private lastRequestTime: number = 0;

  // 重试配置
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 5000; // 5秒

  constructor(config: BaiduSpeechConfig) {
    if (!config.apiKey || !config.secretKey) {
      throw new Error('百度API密钥未配置：apiKey 和 secretKey 都是必需的');
    }

    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.minRequestInterval = config.minRequestInterval ?? 2500;
    this.cuid = config.cuid ?? 'baidu-speech-api';
    this.enableLog = config.enableLog ?? true;
  }

  /**
   * 日志输出
   */
  private log(message: string, ...args: any[]) {
    if (this.enableLog) {
      console.log(`[BaiduSpeech] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]) {
    if (this.enableLog) {
      console.error(`[BaiduSpeech] ${message}`, ...args);
    }
  }

  /**
   * 等待以确保请求间隔，避免触发QPS限制
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      this.log(`频率限制，等待 ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * 获取百度API Access Token
   * Token有效期30天，会自动缓存和刷新
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();

    // 如果token还在有效期内（提前1小时刷新）
    if (this.cachedToken && this.tokenExpireTime > now + 3600 * 1000) {
      return this.cachedToken;
    }

    try {
      const response = await axios.post(
        'https://aip.baidubce.com/oauth/2.0/token',
        null,
        {
          params: {
            grant_type: 'client_credentials',
            client_id: this.apiKey,
            client_secret: this.secretKey,
          },
        }
      );

      if (response.data.error) {
        throw new Error(`获取Token失败: ${response.data.error_description}`);
      }

      const accessToken = response.data.access_token as string;
      this.cachedToken = accessToken;
      // expires_in 单位是秒，转换为毫秒时间戳
      this.tokenExpireTime = now + response.data.expires_in * 1000;

      this.log('Token获取成功，有效期至:', new Date(this.tokenExpireTime));
      return accessToken;
    } catch (error: any) {
      this.logError('获取Token失败:', error);
      throw new Error('获取百度API Token失败');
    }
  }

  /**
   * 语音识别（ASR）
   * @param audioBuffer 音频文件的Buffer数据
   * @param format 音频格式：pcm/wav/amr/m4a，默认 wav
   * @param rate 采样率：16000或8000，默认 16000
   * @param devPid 语言模型ID，1537=普通话，1737=英语，默认1537
   * @returns 识别结果文本
   */
  async speechToText(
    audioBuffer: Buffer,
    format: 'pcm' | 'wav' | 'amr' | 'm4a' = 'wav',
    rate: number = 16000,
    devPid: number = 1537,
    retryCount: number = 0
  ): Promise<string> {
    const token = await this.getAccessToken();
    const speech = audioBuffer.toString('base64');
    const len = audioBuffer.length;

    try {
      this.log(`开始语音识别, 音频大小: ${len} bytes, 格式: ${format}, 采样率: ${rate}`);

      // 等待频率限制
      await this.waitForRateLimit();

      const response = await axios.post(
        'https://vop.baidu.com/server_api',
        {
          format,
          rate,
          channel: 1,
          cuid: this.cuid,
          token,
          speech,
          len,
          dev_pid: devPid,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      this.log('百度API响应:', JSON.stringify(response.data));

      if (response.data.err_no !== 0) {
        this.logError(
          `语音识别错误码: ${response.data.err_no}, 错误信息: ${response.data.err_msg}`
        );

        // 处理QPS限制错误（3305），自动重试
        if (response.data.err_no === 3305 && retryCount < this.MAX_RETRIES) {
          const waitTime = this.RETRY_DELAY * (retryCount + 1);
          this.log(
            `遇到QPS限制，等待 ${waitTime}ms 后重试 (${retryCount + 1}/${this.MAX_RETRIES})`
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));
          // 重置最后请求时间，确保重试时有足够的间隔
          this.lastRequestTime = Date.now() - this.minRequestInterval - 1000;
          return this.speechToText(audioBuffer, format, rate, devPid, retryCount + 1);
        }

        // 特殊错误码处理
        if (
          response.data.err_msg?.includes('pv too much') ||
          response.data.err_msg?.includes('qps')
        ) {
          throw new Error('请求过于频繁，请稍后再试');
        }

        throw new Error(`语音识别失败: ${response.data.err_msg}`);
      }

      // 返回识别结果数组的第一个元素
      const result = response.data.result?.[0] || '';
      this.log('识别结果:', result);
      return result;
    } catch (error: any) {
      // 如果是axios错误且响应中有err_no，尝试重试
      if (error.response?.data?.err_no === 3305 && retryCount < this.MAX_RETRIES) {
        const waitTime = this.RETRY_DELAY * (retryCount + 1);
        this.log(
          `遇到QPS限制，等待 ${waitTime}ms 后重试 (${retryCount + 1}/${this.MAX_RETRIES})`
        );
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.lastRequestTime = Date.now() - this.minRequestInterval - 1000;
        return this.speechToText(audioBuffer, format, rate, devPid, retryCount + 1);
      }

      this.logError('语音识别异常:', error.message);
      if (error.response) {
        this.logError('API响应错误:', error.response.data);
      }
      throw new Error(error.message || '语音识别失败');
    }
  }

  /**
   * 语音合成（TTS）
   * @param text 要合成的文本（建议不超过120个汉字）
   * @param options 合成选项
   * @returns 音频文件的Buffer数据（MP3格式）
   */
  async textToSpeech(
    text: string,
    options: TTSOptions = {},
    retryCount: number = 0
  ): Promise<Buffer> {
    const token = await this.getAccessToken();

    // 等待频率限制
    await this.waitForRateLimit();

    const params = {
      tex: encodeURIComponent(text),
      tok: token,
      cuid: this.cuid,
      ctp: '1',
      lan: 'zh',
      spd: options.spd ?? 5,
      pit: options.pit ?? 5,
      vol: options.vol ?? 5,
      per: options.per ?? 0,
      aue: 3, // MP3格式
    };

    try {
      const response = await axios.post(
        'https://tsn.baidu.com/text2audio',
        new URLSearchParams(params as any).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          responseType: 'arraybuffer',
        }
      );

      // 检查返回的Content-Type
      const contentType = response.headers['content-type'];

      if (contentType?.startsWith('audio/')) {
        // 成功返回音频数据
        return Buffer.from(response.data);
      } else {
        // 返回的是JSON错误信息
        const errorText = Buffer.from(response.data).toString('utf-8');
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
        } catch {
          throw new Error('语音合成失败: 未知错误');
        }

        // 处理QPS限制错误，自动重试
        if (errorJson.err_no === 3305 && retryCount < this.MAX_RETRIES) {
          const waitTime = this.RETRY_DELAY * (retryCount + 1);
          this.log(
            `遇到QPS限制，等待 ${waitTime}ms 后重试 (${retryCount + 1}/${this.MAX_RETRIES})`
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));
          this.lastRequestTime = Date.now() - this.minRequestInterval - 1000;
          return this.textToSpeech(text, options, retryCount + 1);
        }

        throw new Error(`语音合成失败: ${errorJson.err_msg}`);
      }
    } catch (error: any) {
      // 如果是QPS限制错误，尝试重试
      if (error.response?.data) {
        const errorText = Buffer.from(error.response.data).toString('utf-8');
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.err_no === 3305 && retryCount < this.MAX_RETRIES) {
            const waitTime = this.RETRY_DELAY * (retryCount + 1);
            this.log(
              `遇到QPS限制，等待 ${waitTime}ms 后重试 (${retryCount + 1}/${this.MAX_RETRIES})`
            );
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.lastRequestTime = Date.now() - this.minRequestInterval - 1000;
            return this.textToSpeech(text, options, retryCount + 1);
          }
        } catch {
          // 忽略解析错误
        }
      }

      this.logError('语音合成失败:', error);
      throw new Error('语音合成失败');
    }
  }
}

/**
 * 便捷函数：从环境变量创建实例
 */
export function createBaiduSpeechAPIFromEnv(): BaiduSpeechAPI {
  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;
  const minInterval = process.env.BAIDU_API_MIN_INTERVAL
    ? parseInt(process.env.BAIDU_API_MIN_INTERVAL)
    : undefined;

  if (!apiKey || !secretKey) {
    throw new Error('环境变量 BAIDU_API_KEY 和 BAIDU_SECRET_KEY 未配置');
  }

  return new BaiduSpeechAPI({
    apiKey,
    secretKey,
    minRequestInterval: minInterval,
  });
}

