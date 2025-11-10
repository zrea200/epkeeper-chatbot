import crypto from 'crypto';
import WebSocket from 'ws';

/**
 * 讯飞语音API核心模块
 * 
 * 功能：
 * - 鉴权URL生成（HMAC-SHA256签名）
 * - QPS限制控制
 * - 语音识别（ASR）
 * - 语音合成（TTS）
 */

export interface XunfeiSpeechConfig {
  /** 讯飞 AppID（必需） */
  appId: string;
  /** 讯飞 APIKey（必需） */
  apiKey: string;
  /** 讯飞 APISecret（必需） */
  apiSecret: string;
  /** 最小请求间隔（毫秒），默认2000ms */
  minRequestInterval?: number;
  /** 是否启用日志，默认 true */
  enableLog?: boolean;
}

export interface TTSOptions {
  /** 音色名称 */
  vcn: string;
  /** 语速 50-200，默认50 */
  speed?: number;
  /** 音调 0-100，默认50 */
  pitch?: number;
  /** 音量 0-100，默认50 */
  volume?: number;
  /** 音频格式 raw/wav，默认raw */
  aue?: string;
}

export class XunfeiSpeechAPI {
  private appId: string;
  private apiKey: string;
  private apiSecret: string;
  private minRequestInterval: number;
  private enableLog: boolean;

  // 请求频率控制
  private lastRequestTime: number = 0;

  constructor(config: XunfeiSpeechConfig) {
    if (!config.appId || !config.apiKey || !config.apiSecret) {
      throw new Error('讯飞API密钥未配置：appId、apiKey 和 apiSecret 都是必需的');
    }

    this.appId = config.appId;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.minRequestInterval = config.minRequestInterval ?? 2000;
    this.enableLog = config.enableLog ?? true;
  }

  /**
   * 日志输出
   */
  private log(message: string, ...args: any[]) {
    if (this.enableLog) {
      console.log(`[XunfeiSpeech] ${message}`, ...args);
    }
  }

  private logError(message: string, ...args: any[]) {
    if (this.enableLog) {
      console.error(`[XunfeiSpeech] ${message}`, ...args);
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
   * 生成讯飞WebSocket API鉴权URL
   * @param host API主机名，如 iat-api.xfyun.cn
   * @param path API路径，如 /v1/iat
   */
  private generateWebSocketAuthUrl(host: string, path: string): string {
    // 生成RFC1123格式的UTC时间
    const date = new Date().toUTCString();
    const algorithm = 'hmac-sha256';
    const headers = 'host date request-line';
    
    // 构建签名字符串（WebSocket格式）
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    
    this.log('WebSocket签名字符串:', signatureOrigin);
    
    // 使用HMAC-SHA256生成签名
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(signatureOrigin)
      .digest('base64');
    
    this.log('生成的签名:', signature.substring(0, 50) + '...');
    
    // 构建authorization字符串
    const authorizationOrigin = `api_key="${this.apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    // 构建WebSocket URL
    const params = new URLSearchParams({
      authorization,
      date,
      host,
    });
    
    const finalUrl = `wss://${host}${path}?${params.toString()}`;
    this.log('WebSocket URL:', finalUrl.substring(0, 150) + '...');
    
    return finalUrl;
  }

  /**
   * 从 WAV 文件中提取 PCM 数据
   * WAV 文件前 44 字节是文件头，实际音频数据从第 44 字节开始
   */
  private extractPcmFromWav(wavBuffer: Buffer): Buffer {
    // 检查是否是 WAV 文件（RIFF 头）
    if (wavBuffer.length < 44 || wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
      // 不是标准 WAV 文件，直接返回
      return wavBuffer;
    }

    // 查找 'data' chunk，通常在第 36 字节位置
    const dataChunkOffset = 36;
    if (wavBuffer.toString('ascii', dataChunkOffset, dataChunkOffset + 4) === 'data') {
      // 读取 data chunk 大小（4字节，小端序）
      const dataSize = wavBuffer.readUInt32LE(dataChunkOffset + 4);
      // PCM 数据从 dataChunkOffset + 8 开始
      const pcmStart = dataChunkOffset + 8;
      return wavBuffer.slice(pcmStart, pcmStart + dataSize);
    }

    // 如果找不到 data chunk，尝试从第 44 字节开始（标准 WAV 文件头大小）
    return wavBuffer.slice(44);
  }

  /**
   * 语音识别（ASR）- 使用WebSocket
   * @param audioBuffer 音频文件的Buffer数据
   * @param format 音频格式：wav/pcm，默认 wav
   * @param rate 采样率：16000，默认 16000
   * @returns 识别结果文本
   */
  async speechToText(
    audioBuffer: Buffer,
    format: 'wav' | 'pcm' = 'wav',
    rate: number = 16000
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        // 如果是 WAV 格式，提取 PCM 数据
        let pcmBuffer = audioBuffer;
        if (format === 'wav') {
          pcmBuffer = this.extractPcmFromWav(audioBuffer);
          this.log(`从 WAV 文件中提取 PCM 数据: ${audioBuffer.length} bytes -> ${pcmBuffer.length} bytes`);
        }

        this.log(`开始语音识别(WebSocket), 音频大小: ${pcmBuffer.length} bytes, 格式: ${format}, 采样率: ${rate}`);

        // 等待频率限制
        this.waitForRateLimit().then(() => {
          // 生成WebSocket鉴权URL
          // 根据文档：wss://iat.xf-yun.com/v1
          const host = 'iat.xf-yun.com';
          const path = '/v1';
          const wsUrl = this.generateWebSocketAuthUrl(host, path);

          // 建立WebSocket连接
          const ws = new WebSocket(wsUrl);

          const recognizedSegments = new Map<number, string>();
          let latestResult = '';
          let isFinal = false;

          // WebSocket连接打开
          ws.on('open', () => {
            this.log('WebSocket连接已建立');

            // 将音频分帧发送（每帧1280字节原始音频，约对应40ms）
            const frameSize = 1280; // 原始音频字节数
            const totalFrames = Math.ceil(pcmBuffer.length / frameSize);
            this.log(`音频总长度: ${pcmBuffer.length} bytes, 将分${totalFrames}帧发送`);

            const iatParams = {
              domain: 'slm',
              language: 'zh_cn',
              accent: 'mandarin',
              dwa: 'wpgs',
              eos: 6000,
              vinfo: 1,
              result: {
                encoding: 'utf8',
                compress: 'raw',
                format: 'plain',
              },
            };

            const sendFrame = (status: 0 | 1 | 2, frameBuffer?: Buffer) => {
              const audioBase64 =
                frameBuffer && frameBuffer.length > 0 ? frameBuffer.toString('base64') : '';

              const frame = {
                header: {
                  app_id: this.appId,
                  status,
                },
                parameter: {
                  iat: iatParams,
                },
                payload: {
                  audio: {
                    encoding: 'raw',
                    sample_rate: rate,
                    audio: audioBase64,
                  },
                },
              };

              ws.send(JSON.stringify(frame));
            };

            const sendDataFrame = (index: number) => {
              if (index >= totalFrames) {
                // 所有音频数据发送完成，发送结束帧
                this.log('音频数据发送完毕，发送结束帧');
                sendFrame(2);
                this.log('所有音频帧已发送');
                return;
              }

              const start = index * frameSize;
              const end = Math.min(start + frameSize, pcmBuffer.length);
              const frameBuffer = pcmBuffer.slice(start, end);
              const isLastChunk = index === totalFrames - 1;
              const status = index === 0 ? 0 : isLastChunk ? 2 : 1;

              sendFrame(status, frameBuffer);

              if (isLastChunk) {
                this.log('所有音频帧已发送');
                return;
              }

              // 添加延迟，避免发送过快
              setTimeout(() => sendDataFrame(index + 1), 40);
            };

            if (totalFrames === 0) {
              // 空音频，直接发送首尾帧
              sendFrame(0);
              sendFrame(2);
              this.log('音频为空，已发送开始/结束帧');
            } else {
              // 开始发送音频帧
              sendDataFrame(0);
            }
          });

          // 接收消息
          ws.on('message', (data: WebSocket.Data) => {
            try {
              const message = JSON.parse(data.toString());
              this.log('收到WebSocket消息:', JSON.stringify(message).substring(0, 200));

              // 检查错误：错误码可能在 message.code 或 message.header.code
              const errorCode = message.header?.code ?? message.code;
              const errorMessage = message.header?.message ?? message.message;
              
              if (errorCode !== undefined && errorCode !== 0) {
                reject(new Error(`语音识别失败: ${errorMessage || '未知错误'} (code: ${errorCode})`));
                ws.close();
                return;
              }

              const payload = message.payload;
              let segmentIsLast = false;

              // 解析识别结果
              if (payload?.result?.text) {
                try {
                  const resultJsonStr = Buffer.from(payload.result.text, 'base64').toString('utf-8');
                  const resultJson = JSON.parse(resultJsonStr);
                  const sn: number =
                    typeof resultJson.sn === 'number' ? resultJson.sn : recognizedSegments.size;

                  if (resultJson.pgs === 'rpl' && Array.isArray(resultJson.rg) && resultJson.rg.length === 2) {
                    const [start, end] = resultJson.rg;
                    for (let index = start; index <= end; index++) {
                      recognizedSegments.delete(index);
                    }
                  }

                  const wsList = Array.isArray(resultJson.ws) ? resultJson.ws : [];
                  let segmentText = '';
                  for (const wsItem of wsList) {
                    const cwArray = Array.isArray(wsItem.cw) ? wsItem.cw : [];
                    for (const cwItem of cwArray) {
                      if (cwItem?.w) {
                        segmentText += cwItem.w;
                      }
                    }
                  }

                  recognizedSegments.set(sn, segmentText);

                  latestResult = Array.from(recognizedSegments.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([, value]) => value)
                    .join('');

                  this.log('当前识别进度:', { sn, segmentText, latestResult });

                  if (resultJson.ls === true) {
                    segmentIsLast = true;
                  }
                } catch (decodeError: any) {
                  this.logError('解析识别结果失败:', decodeError);
                }
              }

              // 检查是否结束
              const headerStatus = message.header?.status ?? message.data?.status;
              const resultStatus = payload?.result?.status;
              if (!isFinal && (headerStatus === 2 || resultStatus === 2 || segmentIsLast)) {
                isFinal = true;
                this.log('识别完成，最终结果:', latestResult);
                resolve(latestResult);
                ws.close();
              }
            } catch (parseError: any) {
              this.logError('解析WebSocket消息失败:', parseError);
            }
          });

          // WebSocket错误
          ws.on('error', (error: Error) => {
            this.logError('WebSocket错误:', error.message);
            reject(new Error(`WebSocket连接失败: ${error.message}`));
          });

          // WebSocket关闭
          ws.on('close', () => {
            if (!isFinal && latestResult) {
              // 如果连接关闭但还有结果，返回结果
              this.log('WebSocket关闭，返回部分结果:', latestResult);
              resolve(latestResult);
            } else if (!isFinal) {
              reject(new Error('WebSocket连接意外关闭，未收到识别结果'));
            }
          });

          // 设置超时（30秒）
          setTimeout(() => {
            if (!isFinal) {
              ws.close();
              if (latestResult) {
                resolve(latestResult);
              } else {
                reject(new Error('语音识别超时'));
              }
            }
          }, 30000);
        }).catch(reject);
      } catch (error: any) {
        this.logError('语音识别异常:', error.message);
        reject(new Error(error.message || '语音识别失败'));
      }
    });
  }

  /**
   * 语音合成（TTS）
   * @param text 要合成的文本
   * @param options 合成选项
   * @returns 音频文件的Buffer数据
   */
  async textToSpeech(text: string, options: TTSOptions): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const trimmedText = text?.trim();
      if (!trimmedText) {
        reject(new Error('语音合成失败: 文本内容为空'));
        return;
      }

      this.log(`开始语音合成, 文本长度: ${trimmedText.length}, 音色: ${options.vcn}`);

      try {
        await this.waitForRateLimit();
      } catch (error: any) {
        reject(new Error(error?.message || '语音合成失败: 频率限制'));
        return;
      }

      const host = 'tts-api.xfyun.cn';
      const path = '/v2/tts';
      const wsUrl = this.generateWebSocketAuthUrl(host, path);

      const ws = new WebSocket(wsUrl);
      const audioChunks: Buffer[] = [];
      let isClosed = false;
      let hasResolved = false;
      let timeoutId: NodeJS.Timeout | undefined;

      const clearPendingTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      const resetTimeout = () => {
        clearPendingTimeout();
        timeoutId = setTimeout(() => {
          finishWithError('语音合成超时');
        }, 30000);
      };

      const cleanup = () => {
        clearPendingTimeout();
        if (!isClosed) {
          isClosed = true;
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        }
      };

      const finishWithSuccess = () => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        if (audioChunks.length === 0) {
          reject(new Error('语音合成失败: 未返回音频数据'));
          return;
        }
        resolve(Buffer.concat(audioChunks));
      };

      const finishWithError = (error: Error | string) => {
        if (hasResolved) return;
        hasResolved = true;
        cleanup();
        reject(typeof error === 'string' ? new Error(error) : error);
      };

      resetTimeout();

      ws.on('open', () => {
        resetTimeout();

        const business: Record<string, any> = {
          vcn: options.vcn,
          speed: options.speed ?? 50,
          pitch: options.pitch ?? 50,
          volume: options.volume ?? 50,
          bgs: 0,
          aue: options.aue ?? 'lame',
          tte: 'utf8',
        };

        if (business.aue === 'raw') {
          business.auf = 'audio/L16;rate=16000';
        }

        const frame = {
          common: {
            app_id: this.appId,
          },
          business,
          data: {
            status: 2,
            text: Buffer.from(trimmedText, 'utf-8').toString('base64'),
          },
        };

        this.log('发送TTS请求帧');
        ws.send(JSON.stringify(frame));
      });

      ws.on('message', (buffer: WebSocket.RawData) => {
        resetTimeout();
        try {
          const message = JSON.parse(buffer.toString());
          this.log('收到TTS消息:', JSON.stringify(message).substring(0, 200));

          if (typeof message.code === 'number' && message.code !== 0) {
            finishWithError(
              new Error(`语音合成失败: ${message.message || '未知错误'} (code: ${message.code})`)
            );
            return;
          }

          const audioBase64: string | undefined = message.data?.audio;
          const status: number | undefined = message.data?.status;

          if (audioBase64) {
            audioChunks.push(Buffer.from(audioBase64, 'base64'));
          }

          if (status === 2) {
            finishWithSuccess();
          }
        } catch (error: any) {
          finishWithError(new Error(`语音合成失败: 解析数据异常 - ${error.message || error}`));
        }
      });

      ws.on('error', (error: Error) => {
        clearPendingTimeout();
        finishWithError(new Error(`语音合成失败: WebSocket错误 - ${error.message}`));
      });

      ws.on('close', () => {
        clearPendingTimeout();
        if (!hasResolved) {
          if (audioChunks.length > 0) {
            finishWithSuccess();
          } else {
            finishWithError(new Error('语音合成失败: WebSocket提前关闭'));
          }
        }
      });
    });
  }
}

/**
 * 便捷函数：从环境变量创建实例
 */
export function createXunfeiSpeechAPIFromEnv(): XunfeiSpeechAPI {
  const appId = process.env.XUNFEI_APP_ID;
  const apiKey = process.env.XUNFEI_API_KEY;
  const apiSecret = process.env.XUNFEI_API_SECRET;
  const minInterval = process.env.XUNFEI_API_MIN_INTERVAL
    ? parseInt(process.env.XUNFEI_API_MIN_INTERVAL)
    : undefined;

  if (!appId || !apiKey || !apiSecret) {
    throw new Error('环境变量 XUNFEI_APP_ID、XUNFEI_API_KEY 和 XUNFEI_API_SECRET 未配置');
  }

  return new XunfeiSpeechAPI({
    appId,
    apiKey,
    apiSecret,
    minRequestInterval: minInterval,
  });
}

