/**
 * 百度语音服务工具
 * 支持语音识别和语音合成
 */

import BAIDU_SPEECH_CONFIG from '@/config/speech-config';

/**
 * 获取百度 Access Token
 */
async function getBaiduAccessToken(): Promise<string> {
  const { apiKey, secretKey } = BAIDU_SPEECH_CONFIG;
  
  // 从缓存中获取
  const cached = localStorage.getItem('baidu_access_token');
  const cacheTime = localStorage.getItem('baidu_token_time');
  
  if (cached && cacheTime) {
    const elapsed = Date.now() - parseInt(cacheTime);
    // token 有效期 30 天，提前 1 天刷新
    if (elapsed < 29 * 24 * 60 * 60 * 1000) {
      return cached;
    }
  }
  
  // 获取新 token
  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
  
  try {
    const response = await fetch(url, { method: 'POST' });
    const data = await response.json();
    
    if (data.access_token) {
      localStorage.setItem('baidu_access_token', data.access_token);
      localStorage.setItem('baidu_token_time', Date.now().toString());
      return data.access_token;
    }
    
    throw new Error('获取 Access Token 失败');
  } catch (error) {
    console.error('获取百度 Access Token 失败:', error);
    throw error;
  }
}

/**
 * 百度语音识别类
 */
export class BaiduSpeechRecognizer {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening: boolean = false;
  private onResultCallback?: (text: string) => void;
  private onErrorCallback?: (error: string) => void;

  /**
   * 开始语音识别
   */
  async start(onResult: (text: string) => void, onError?: (error: string) => void) {
    if (this.isListening) {
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    this.audioChunks = [];

    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      // 监听数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // 录音结束
      this.mediaRecorder.onstop = async () => {
        try {
          // 合并音频数据
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          
          // 转换为 WAV 格式并发送识别请求
          const text = await this.recognizeAudio(audioBlob);
          this.onResultCallback?.(text);
          
          // 停止所有音轨
          stream.getTracks().forEach(track => track.stop());
        } catch (error: any) {
          console.error('语音识别失败:', error);
          this.onErrorCallback?.(error.message || '识别失败');
        }
      };

      // 开始录音
      this.mediaRecorder.start();
      this.isListening = true;
    } catch (error: any) {
      console.error('启动录音失败:', error);
      onError?.('无法访问麦克风，请检查权限设置');
    }
  }

  /**
   * 停止语音识别
   */
  stop() {
    if (this.mediaRecorder && this.isListening) {
      this.mediaRecorder.stop();
      this.isListening = false;
    }
  }

  /**
   * 调用百度语音识别API
   */
  private async recognizeAudio(audioBlob: Blob): Promise<string> {
    try {
      // 转换为 base64
      const base64Audio = await this.blobToBase64(audioBlob);
      
      // 获取 access token
      const token = await getBaiduAccessToken();
      
      // 调用百度语音识别 API
      const { language, rate, format, channel } = BAIDU_SPEECH_CONFIG.recognition;
      const url = `https://vop.baidu.com/server_api`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          rate,
          channel,
          cuid: this.getDeviceId(),
          token,
          speech: base64Audio.split(',')[1], // 移除 data:audio/webm;base64, 前缀
          len: audioBlob.size,
          lan: language,
        }),
      });

      const result = await response.json();
      
      if (result.err_no === 0 && result.result && result.result.length > 0) {
        return result.result[0];
      }
      
      throw new Error(result.err_msg || '识别失败');
    } catch (error: any) {
      console.error('百度语音识别API调用失败:', error);
      throw new Error('语音识别服务暂时不可用');
    }
  }

  /**
   * 将 Blob 转换为 Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('转换失败'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * 获取设备ID
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'web_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * 获取当前是否正在监听
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}

/**
 * 百度语音合成类
 */
export class BaiduSpeechSynthesizer {
  private audio: HTMLAudioElement | null = null;
  private isSpeaking: boolean = false;

  /**
   * 播报文本
   */
  async speak(text: string, options?: {
    onEnd?: () => void;
    onError?: (error: any) => void;
  }) {
    // 停止当前播报
    this.stop();

    try {
      // 获取 access token
      const token = await getBaiduAccessToken();
      
      // 调用百度语音合成 API
      const { vol, spd, pit, per, aue } = BAIDU_SPEECH_CONFIG.synthesis;
      const url = `https://tsn.baidu.com/text2audio`;
      
      const params = new URLSearchParams({
        tok: token,
        tex: encodeURIComponent(text),
        cuid: this.getDeviceId(),
        lan: 'zh',
        ctp: '1',
        vol: vol.toString(),
        spd: spd.toString(),
        pit: pit.toString(),
        per: per.toString(),
        aue: aue.toString(),
      });

      // 创建音频元素
      this.audio = new Audio(`${url}?${params.toString()}`);
      
      this.audio.onplay = () => {
        this.isSpeaking = true;
      };

      this.audio.onended = () => {
        this.isSpeaking = false;
        options?.onEnd?.();
      };

      this.audio.onerror = (event) => {
        this.isSpeaking = false;
        console.error('语音播放失败:', event);
        options?.onError?.(event);
      };

      // 播放音频
      await this.audio.play();
    } catch (error) {
      console.error('百度语音合成失败:', error);
      this.isSpeaking = false;
      options?.onError?.(error);
    }
  }

  /**
   * 停止播报
   */
  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
      this.isSpeaking = false;
    }
  }

  /**
   * 暂停播报
   */
  pause() {
    if (this.audio && this.isSpeaking) {
      this.audio.pause();
    }
  }

  /**
   * 恢复播报
   */
  resume() {
    if (this.audio && !this.isSpeaking) {
      this.audio.play();
    }
  }

  /**
   * 获取设备ID
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'web_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * 获取当前是否正在播报
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

