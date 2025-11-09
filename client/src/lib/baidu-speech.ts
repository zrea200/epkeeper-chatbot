/**
 * 百度语音服务工具
 * 支持语音识别和语音合成
 */

import BAIDU_SPEECH_CONFIG from '@/config/speech-config';

/**
 * 检测浏览器环境信息
 */
function getBrowserInfo(): {
  userAgent: string;
  isWeChat: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
} {
  const ua = navigator.userAgent.toLowerCase();
  return {
    userAgent: ua,
    isWeChat: /micromessenger/.test(ua),
    isMobile: /mobile|android|iphone|ipad/.test(ua),
    isIOS: /iphone|ipad|ipod/.test(ua),
    isAndroid: /android/.test(ua),
  };
}

/**
 * 检测浏览器支持的音频格式
 * 优先尝试移动端常用格式，回退到 webm
 */
function getSupportedMimeType(): string {
  const browserInfo = getBrowserInfo();
  console.log('🔍 浏览器环境检测:', browserInfo);
  
  const mimeTypes = [
    'audio/mp4',           // 移动端常用格式（iOS Safari, 微信）
    'audio/aac',           // 移动端常用格式
    'audio/mpeg',          // MP3 格式
    'audio/ogg',           // Ogg 格式
    'audio/webm;codecs=opus', // WebM with opus codec
    'audio/webm',          // 默认 WebM
  ];

  const supportedTypes: string[] = [];
  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      supportedTypes.push(mimeType);
    }
  }

  console.log('📋 支持的音频格式列表:', supportedTypes);

  if (supportedTypes.length > 0) {
    const selectedType = supportedTypes[0];
    console.log('✅ 选择使用的音频格式:', selectedType);
    return selectedType;
  }

  // 如果没有检测到任何格式，尝试使用 webm（可能在某些浏览器中仍然工作）
  console.warn('⚠️ 未检测到明确的音频格式支持，使用默认 audio/webm');
  console.warn('⚠️ 浏览器信息:', browserInfo);
  return 'audio/webm';
}

/**
 * 使用 XMLHttpRequest 获取百度 Access Token（备选方案，用于微信浏览器）
 */
function getBaiduAccessTokenWithXHR(url: string, timeout: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeoutId = setTimeout(() => {
      xhr.abort();
      reject(new Error('请求超时，请检查网络连接'));
    }, timeout);

    xhr.open('GET', url, true);
    xhr.timeout = timeout;
    
    // 设置请求头
    xhr.setRequestHeader('Accept', 'application/json');
    
    xhr.onload = () => {
      clearTimeout(timeoutId);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.access_token) {
            resolve(data.access_token);
          } else {
            const errorMsg = data.error_description || data.error || '获取 Access Token 失败';
            reject(new Error(`获取 Access Token 失败: ${errorMsg}`));
          }
        } catch (parseError) {
          reject(new Error(`响应格式错误，无法解析 JSON: ${xhr.responseText.substring(0, 100)}`));
        }
      } else {
        reject(new Error(`获取 Token 失败: HTTP ${xhr.status} ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error('网络请求失败，请检查网络连接'));
    };

    xhr.ontimeout = () => {
      clearTimeout(timeoutId);
      reject(new Error('请求超时，请检查网络连接'));
    };

    xhr.send();
  });
}

/**
 * 获取百度 Access Token
 * 在微信浏览器中使用多种方法尝试，提高成功率
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
  
  const browserInfo = getBrowserInfo();
  console.log('🔑 开始获取百度 Access Token:', {
    url: url.substring(0, 80) + '...',
    hasApiKey: !!apiKey,
    hasSecretKey: !!secretKey,
    browserInfo: browserInfo
  });
  
  // 在微信浏览器中，优先使用 GET 请求，如果失败则尝试 XMLHttpRequest
  const isWeChat = browserInfo.isWeChat;
  
  // 方法1: 尝试使用 GET 请求（百度 OAuth API 支持 GET）
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      // 使用 GET 请求，在微信浏览器中更稳定
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
        // 添加 mode 和 credentials 选项，提高兼容性
        mode: 'cors',
        credentials: 'omit',
      });
      
      clearTimeout(timeoutId);
      
      console.log('📥 获取 Token 响应状态:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });
      
      if (!response.ok) {
        throw new Error(`获取 Token 失败: HTTP ${response.status} ${response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log('📄 响应内容:', responseText.substring(0, 200));
      
      const data = JSON.parse(responseText);
      
      console.log('📋 解析后的数据:', {
        hasAccessToken: !!data.access_token,
        hasError: !!data.error,
        error: data.error,
        errorDescription: data.error_description
      });
      
      if (data.access_token) {
        localStorage.setItem('baidu_access_token', data.access_token);
        localStorage.setItem('baidu_token_time', Date.now().toString());
        console.log('✅ 百度 Access Token 获取成功 (GET)');
        return data.access_token;
      }
      
      const errorMsg = data.error_description || data.error || '获取 Access Token 失败';
      throw new Error(`获取 Access Token 失败: ${errorMsg}`);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      // 如果是微信浏览器且 fetch 失败，尝试使用 XMLHttpRequest
      if (isWeChat && (fetchError.name === 'TypeError' || fetchError.message?.includes('Failed to fetch'))) {
        console.log('⚠️ Fetch 失败，尝试使用 XMLHttpRequest (微信浏览器)');
        try {
          const token = await getBaiduAccessTokenWithXHR(url, 10000);
          localStorage.setItem('baidu_access_token', token);
          localStorage.setItem('baidu_token_time', Date.now().toString());
          console.log('✅ 百度 Access Token 获取成功 (XHR)');
          return token;
        } catch (xhrError: any) {
          console.error('❌ XMLHttpRequest 也失败:', xhrError);
          // 继续抛出原始错误
          throw fetchError;
        }
      }
      
      if (fetchError.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接');
      }
      throw fetchError;
    }
  } catch (error: any) {
    // 方法2: 使用本地服务端代理，绕过微信浏览器限制
    try {
      console.log('🌐 尝试通过本地代理获取 Token');
      const proxyUrl = `/api/baidu/token?apiKey=${encodeURIComponent(apiKey)}&secretKey=${encodeURIComponent(secretKey)}`;
      const resp = await fetch(proxyUrl, { method: 'GET' });
      const text = await resp.text();
      const data = JSON.parse(text);
      if (data?.access_token) {
        localStorage.setItem('baidu_access_token', data.access_token);
        localStorage.setItem('baidu_token_time', Date.now().toString());
        console.log('✅ 百度 Access Token 获取成功 (代理)');
        return data.access_token;
      }
      console.error('❌ 代理返回错误:', data);
    } catch (proxyErr: any) {
      console.error('❌ 本地代理也失败:', {
        error: proxyErr,
        message: proxyErr?.message,
        name: proxyErr?.name,
        responseText: proxyErr?.responseText?.substring(0, 200)
      });
      // 如果返回的是HTML，说明路由被拦截了
      if (proxyErr?.message?.includes('<!doctype') || proxyErr?.message?.includes('Unexpected token')) {
        console.error('⚠️ 代理返回了HTML而不是JSON，可能是路由配置问题');
      }
      // 继续走统一错误处理
    }

    console.error('❌ 获取百度 Access Token 异常:', {
      error: error,
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      browserInfo: browserInfo
    });
    
    if (error.message && error.message.includes('Access Token')) {
      throw error;
    }
    
    // 提供更详细的错误信息
    let errorMessage = '获取 Access Token 失败';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
      errorMessage = '网络请求失败，可能是网络连接问题或 CORS 限制。如果在微信中，请检查网络连接';
    } else if (error.name === 'AbortError') {
      errorMessage = '请求超时，请检查网络连接';
    } else {
      errorMessage = `获取 Access Token 失败: ${error.message || '未知错误'}。请检查网络连接和 API 配置`;
    }
    
    throw new Error(errorMessage);
  }
}

// QPS控制：记录上次请求时间，避免频繁请求
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2500; // 最小请求间隔2.5秒

/**
 * 等待以确保请求间隔，避免触发QPS限制
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`⏱️ QPS控制，等待 ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * 检测是否为网络/CORS错误，需要回退到服务端代理
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // TypeError通常表示CORS或网络问题
  if (error.name === 'TypeError') {
    return true;
  }
  
  // Failed to fetch 通常表示网络问题
  if (error.message && (
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('Network request failed')
  )) {
    return true;
  }
  
  return false;
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
  private currentMimeType: string = 'audio/webm'; // 保存当前使用的音频格式

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
      const browserInfo = getBrowserInfo();
      console.log('🎤 开始语音识别，环境信息:', browserInfo);
      
      // 请求麦克风权限，优化音频质量设置
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,      // 回声消除
        noiseSuppression: true,      // 噪声抑制
        autoGainControl: true,       // 自动增益控制
        sampleRate: 16000,           // 采样率16kHz（百度推荐）
        channelCount: 1,             // 单声道
      };
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints 
      });
      
      // 获取实际使用的音频参数
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      console.log('✅ 麦克风权限获取成功，音频参数:', {
        采样率: settings.sampleRate,
        声道数: settings.channelCount,
        回声消除: settings.echoCancellation,
        噪声抑制: settings.noiseSuppression,
        自动增益: settings.autoGainControl
      });
      
      // 检测并使用支持的音频格式
      const mimeType = getSupportedMimeType();
      this.currentMimeType = mimeType; // 保存当前使用的格式
      console.log('🎤 使用音频格式:', mimeType);
      
      // 创建 MediaRecorder，优先使用高质量格式
      // 优先使用 PCM 或 WAV 格式，避免压缩损失
      const preferredMimeTypes = [
        mimeType,
        'audio/webm;codecs=pcm',  // WebM PCM（无损）
        'audio/webm;codecs=opus', // WebM Opus（高质量压缩）
        'audio/webm',              // 默认 WebM
      ];
      
      let recorderCreated = false;
      for (const preferredType of preferredMimeTypes) {
        try {
          if (MediaRecorder.isTypeSupported(preferredType)) {
            this.mediaRecorder = new MediaRecorder(stream, {
              mimeType: preferredType,
              audioBitsPerSecond: 128000, // 128kbps，提高音质
            });
            this.currentMimeType = preferredType;
            console.log('✅ MediaRecorder 创建成功，使用格式:', preferredType);
            recorderCreated = true;
            break;
          }
        } catch (err) {
          // 继续尝试下一个格式
        }
      }
      
      if (!recorderCreated) {
        console.warn('⚠️ 无法创建指定格式的MediaRecorder，使用默认配置');
        try {
          this.mediaRecorder = new MediaRecorder(stream, {
            audioBitsPerSecond: 128000, // 提高音质
          });
        } catch (recorderError: any) {
          console.error('❌ MediaRecorder 创建失败，使用最简配置:', recorderError);
          this.mediaRecorder = new MediaRecorder(stream);
        }
        // 获取实际使用的格式
        if (this.mediaRecorder.mimeType) {
          this.currentMimeType = this.mediaRecorder.mimeType;
        }
        console.log('⚠️ 使用默认 MediaRecorder 配置，格式:', this.currentMimeType);
      }

      // 监听数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // 记录录音开始时间
      const recordingStartTime = Date.now();
      
      // 录音结束
      this.mediaRecorder.onstop = async () => {
        try {
          const recordingDuration = Date.now() - recordingStartTime;
          console.log(`⏱️ 录音时长: ${recordingDuration}ms`);
          
          // 检查录音时长（太短可能识别不准）
          if (recordingDuration < 500) {
            console.warn('⚠️ 录音时长过短，可能影响识别准确率');
            this.onErrorCallback?.('录音时长过短，请至少录音0.5秒');
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          // 合并音频数据（使用保存的格式）
          const audioBlob = new Blob(this.audioChunks, { type: this.currentMimeType });
          
          // 检查音频大小
          if (audioBlob.size < 1000) {
            console.warn('⚠️ 音频数据过小，可能录音失败');
            this.onErrorCallback?.('录音数据异常，请重试');
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          // 转换为 WAV 格式并发送识别请求
          console.log('📝 开始转换音频格式:', this.currentMimeType, '-> wav');
          const wavBlob = await this.convertAudioToWav(audioBlob, stream);
          const text = await this.recognizeAudio(wavBlob);
          this.onResultCallback?.(text);
          
          // 停止所有音轨
          stream.getTracks().forEach(track => track.stop());
        } catch (error: any) {
          console.error('❌ 语音识别失败:', error);
          this.onErrorCallback?.(error.message || '识别失败');
          // 停止所有音轨
          stream.getTracks().forEach(track => track.stop());
        }
      };

      // 开始录音
      this.mediaRecorder.start();
      this.isListening = true;
      console.log('✅ 录音已开始');
    } catch (error: any) {
      const browserInfo = getBrowserInfo();
      console.error('❌ 启动录音失败:', {
        error: error.message || error,
        name: error.name,
        browserInfo: browserInfo,
        mediaDevicesSupported: !!navigator.mediaDevices,
        getUserMediaSupported: !!navigator.mediaDevices?.getUserMedia,
      });
      
      let errorMessage = '无法访问麦克风，请检查权限设置';
      if (error.name === 'NotAllowedError') {
        errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未找到麦克风设备';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '当前浏览器不支持录音功能';
      }
      
      onError?.(errorMessage);
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
   * 将音频转换为 WAV 格式（支持多种输入格式）
   */
  private async convertAudioToWav(audioBlob: Blob, stream: MediaStream): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async () => {
        try {
          // 解码音频数据
          const audioBuffer = await audioContext.decodeAudioData(fileReader.result as ArrayBuffer);
          
          // 获取配置参数
          const { rate } = BAIDU_SPEECH_CONFIG.recognition;
          const sampleRate = rate; // 16000 或 8000
          
          // 如果采样率不匹配，需要重采样
          let processedBuffer = audioBuffer;
          if (audioBuffer.sampleRate !== sampleRate) {
            console.log(`🔄 重采样: ${audioBuffer.sampleRate}Hz -> ${sampleRate}Hz`);
            processedBuffer = await this.resampleAudio(audioBuffer, sampleRate);
          }
          
          // 音频预处理：归一化音量，提高识别准确率
          processedBuffer = this.normalizeAudio(processedBuffer);
          
          // 转换为 WAV
          const wavBuffer = this.audioBufferToWav(processedBuffer);
          const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          
          console.log('✅ 音频格式转换成功:', {
            原始格式: audioBlob.type,
            原始大小: `${(audioBlob.size / 1024).toFixed(2)} KB`,
            转换后大小: `${(wavBlob.size / 1024).toFixed(2)} KB`,
            采样率: `${sampleRate}Hz`
          });
          
          resolve(wavBlob);
        } catch (error) {
          console.error('❌ 音频转换失败:', error);
          reject(error);
        } finally {
          audioContext.close();
        }
      };
      
      fileReader.onerror = reject;
      fileReader.readAsArrayBuffer(audioBlob);
    });
  }

  /**
   * 重采样音频（使用高质量算法）
   */
  private async resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    const sourceSampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = Math.round(audioBuffer.length * targetSampleRate / sourceSampleRate);
    
    // 使用 OfflineAudioContext 进行高质量重采样
    const offlineContext = new OfflineAudioContext(numberOfChannels, length, targetSampleRate);
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    return await offlineContext.startRendering();
  }

  /**
   * 音频归一化：提高音量并避免削波
   */
  private normalizeAudio(audioBuffer: AudioBuffer): AudioBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    
    // 找到最大振幅
    let maxAmplitude = 0;
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > maxAmplitude) {
          maxAmplitude = abs;
        }
      }
    }
    
    // 如果音量太小或太大，进行归一化
    if (maxAmplitude > 0 && maxAmplitude < 0.5) {
      const gain = 0.8 / maxAmplitude; // 归一化到80%，避免削波
      const normalizedBuffer = new AudioBuffer({
        numberOfChannels,
        length,
        sampleRate
      });
      
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = normalizedBuffer.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          outputData[i] = inputData[i] * gain;
        }
      }
      
      console.log(`🔊 音频归一化: 增益 ${gain.toFixed(2)}x`);
      return normalizedBuffer;
    }
    
    return audioBuffer;
  }

  /**
   * 将 AudioBuffer 转换为 WAV 格式
   */
  private audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * numChannels * bytesPerSample);
    const view = new DataView(arrayBuffer);
    
    // WAV 文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, length * numChannels * bytesPerSample, true);
    
    // 写入音频数据
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  }

  /**
   * 调用百度语音识别API（直接调用+智能回退）
   */
  private async recognizeAudio(audioBlob: Blob): Promise<string> {
    // 转换为 base64
    const base64Audio = await this.blobToBase64(audioBlob);
    const { language, rate, format, channel } = BAIDU_SPEECH_CONFIG.recognition;
    
    // 移除 data:audio/wav;base64, 前缀（如果有）
    const base64Data = base64Audio.replace(/^data:[^,]*,/, '');
    // 计算base64解码后的长度（浏览器环境）
    const audioLength = Math.floor(base64Data.length * 3 / 4) - (base64Data.match(/=/g) || []).length;

    console.log('📤 准备语音识别:', {
      格式: format,
      采样率: `${rate}Hz`,
      声道数: channel,
      音频大小: `${(audioBlob.size / 1024).toFixed(2)} KB`
    });

    // 等待QPS控制
    await waitForRateLimit();

    // 方法1: 尝试直接调用百度API
    try {
      console.log('🌐 尝试直接调用百度语音识别API');
      const token = await getBaiduAccessToken();
      
      // 根据 language 确定 devPid（1537=普通话，1737=英语）
      const devPid = language === 'en' ? 1737 : 1537;
      
      const directApiUrl = 'https://vop.baidu.com/server_api';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000); // 30秒超时

      let response;
      try {
        response = await fetch(directApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            format,
            rate,
            channel,
            cuid: 'web_client',
            token,
            speech: base64Data,
            len: audioLength,
            dev_pid: devPid,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('请求超时');
        }
        throw fetchError;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      
      if (result.err_no === 0 && result.result && result.result.length > 0) {
        const text = result.result[0];
        console.log('✅ 语音识别成功(直接调用):', text);
        return text;
      }
      
      // API返回错误，但不一定是网络问题，可能是业务错误
      const errorMsg = result.err_msg || '识别失败';
      throw new Error(`百度API错误: ${errorMsg} (err_no: ${result.err_no})`);
      
    } catch (directError: any) {
      // 如果是网络/CORS错误，回退到服务端代理
      if (isNetworkError(directError)) {
        console.warn('⚠️ 直接调用失败（网络/CORS错误），回退到服务端代理:', directError.message);
        return await this.recognizeAudioViaProxy(base64Audio, format, rate, channel, language);
      }
      
      // 其他错误（如API错误、超时等），也尝试回退
      console.warn('⚠️ 直接调用失败，尝试回退到服务端代理:', directError.message);
      try {
        return await this.recognizeAudioViaProxy(base64Audio, format, rate, channel, language);
      } catch (proxyError: any) {
        // 代理也失败，抛出原始错误
        throw new Error(`语音识别失败: ${directError.message || '未知错误'}`);
      }
    }
  }

  /**
   * 通过服务端代理调用百度语音识别API（回退方案）
   */
  private async recognizeAudioViaProxy(
    base64Audio: string,
    format: string,
    rate: number,
    channel: number,
    language: string
  ): Promise<string> {
    const { apiKey, secretKey } = BAIDU_SPEECH_CONFIG;
    const requestUrl = '/api/asr/baidu';
    console.log('📤 通过服务端代理发送语音识别请求:', {
      请求URL: requestUrl,
      当前域名: window.location.origin
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ 请求超时，正在取消...');
      controller.abort();
    }, 30000); // 30秒超时

    let response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          rate,
          channel,
          base64: base64Audio,
          language,
          apiKey,  // 传递 API Key
          secretKey,  // 传递 Secret Key
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('语音识别请求超时，请检查网络连接或稍后重试');
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法读取错误信息');
      console.error('❌ 服务端响应错误:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText.substring(0, 200)
      });
      throw new Error(`服务端错误: HTTP ${response.status} ${response.statusText}`);
    }

    const responseText = await response.text();
    
    if (!responseText || responseText.trim().length === 0) {
      console.error('❌ 服务端返回空响应');
      throw new Error('服务端返回空响应，请检查服务端日志');
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError: any) {
      console.error('❌ JSON解析失败:', {
        error: parseError.message,
        responseText: responseText.substring(0, 200),
        contentType: response.headers.get('content-type')
      });
      throw new Error(`响应格式错误: ${parseError.message}。响应内容: ${responseText.substring(0, 100)}`);
    }
    
    console.log('📥 百度语音识别响应(代理):', {
      err_no: result.err_no,
      err_msg: result.err_msg,
      text: result.text
    });
    
    if (result?.text) {
      console.log('✅ 语音识别成功(代理):', result.text);
      return result.text;
    }
    
    const errorMsg = result?.error_description || result?.error || '识别失败';
    console.error('❌ 语音识别失败(代理):', result);
    throw new Error(errorMsg);
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
  private currentAudioUrl: string | null = null; // 用于清理 URL 对象

  /**
   * 播报文本（直接调用+智能回退）
   */
  async speak(text: string, options?: {
    onEnd?: () => void;
    onError?: (error: any) => void;
  }) {
    // 停止当前播报
    this.stop();

    try {
      const { vol, spd, pit, per } = BAIDU_SPEECH_CONFIG.synthesis;
      const browserInfo = getBrowserInfo();
      
      console.log('🔊 开始请求语音合成:', { 
        textLength: text.length,
        browserInfo: browserInfo
      });

      // 等待QPS控制
      await waitForRateLimit();

      // 方法1: 尝试直接调用百度API
      let audioBlob: Blob;
      try {
        console.log('🌐 尝试直接调用百度语音合成API');
        audioBlob = await this.speakViaDirectAPI(text, spd, pit, vol, per);
        console.log('✅ 语音合成成功(直接调用)，音频大小:', `${(audioBlob.size / 1024).toFixed(2)} KB`);
      } catch (directError: any) {
        // 如果是网络/CORS错误，回退到服务端代理
        if (isNetworkError(directError)) {
          console.warn('⚠️ 直接调用失败（网络/CORS错误），回退到服务端代理:', directError.message);
          audioBlob = await this.speakViaProxy(text, spd, pit, vol, per);
          console.log('✅ 语音合成成功(代理)，音频大小:', `${(audioBlob.size / 1024).toFixed(2)} KB`);
        } else {
          // 其他错误也尝试回退
          console.warn('⚠️ 直接调用失败，尝试回退到服务端代理:', directError.message);
          try {
            audioBlob = await this.speakViaProxy(text, spd, pit, vol, per);
            console.log('✅ 语音合成成功(代理)，音频大小:', `${(audioBlob.size / 1024).toFixed(2)} KB`);
          } catch (proxyError: any) {
            throw new Error(`语音合成失败: ${directError.message || '未知错误'}`);
          }
        }
      }
      // 清理之前的 URL 对象
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
      }
      this.currentAudioUrl = URL.createObjectURL(audioBlob);

      // 创建音频元素
      this.audio = new Audio(this.currentAudioUrl);
      
      // 设置音频属性，确保在移动端正常工作
      this.audio.preload = 'auto';
      
      // 等待音频加载完成
      await new Promise<void>((resolve, reject) => {
        if (!this.audio) {
          reject(new Error('音频元素未创建'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('音频加载超时'));
        }, 10000); // 10秒超时

        this.audio!.onloadeddata = () => {
          clearTimeout(timeout);
          console.log('✅ 语音加载完成');
          resolve();
        };

        this.audio!.onerror = (event) => {
          clearTimeout(timeout);
          const error = new Error('音频加载失败');
          console.error('❌ 语音加载失败:', event);
          reject(error);
        };

        // 如果已经可以播放，直接 resolve
        if (this.audio.readyState >= 2) {
          clearTimeout(timeout);
          resolve();
        }
      });

      // 清理 URL 对象（播放完成后）
      this.audio.onended = () => {
        this.isSpeaking = false;
        console.log('✅ 语音播放完成');
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
          this.currentAudioUrl = null;
        }
        options?.onEnd?.();
      };

      this.audio.onplay = () => {
        this.isSpeaking = true;
        console.log('▶️ 语音开始播放');
      };

      this.audio.onerror = (event) => {
        this.isSpeaking = false;
        const error = this.audio?.error;
        const errorMsg = error 
          ? `播放错误: ${error.code} - ${error.message}`
          : '音频播放失败';
        console.error('❌ 语音播放失败:', {
          event,
          error: errorMsg,
          readyState: this.audio?.readyState,
          networkState: this.audio?.networkState
        });
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
          this.currentAudioUrl = null;
        }
        options?.onError?.(new Error(errorMsg));
      };

      // 尝试播放音频（移动端需要在用户交互中触发）
      try {
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        console.log('✅ 语音播放已启动');
      } catch (playError: any) {
        // 播放失败，可能是 autoplay 限制
        console.error('❌ 语音播放启动失败:', playError);
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
          this.currentAudioUrl = null;
        }
        const errorMsg = playError.message || '无法播放音频，请检查是否在用户交互中触发';
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('❌ 百度语音合成失败:', error);
      this.isSpeaking = false;
      const errorMsg = error?.message || '语音合成服务失败';
      options?.onError?.(error instanceof Error ? error : new Error(errorMsg));
    }
  }

  /**
   * 直接调用百度语音合成API
   */
  private async speakViaDirectAPI(
    text: string,
    spd: number,
    pit: number,
    vol: number,
    per: number
  ): Promise<Blob> {
    const token = await getBaiduAccessToken();
    const directApiUrl = 'https://tsn.baidu.com/text2audio';
    const { aue } = BAIDU_SPEECH_CONFIG.synthesis;
    
    // 构建URL-encoded参数
    const params = new URLSearchParams({
      tex: text,
      tok: token,
      cuid: 'web_client',
      ctp: '1',
      lan: 'zh',
      spd: spd.toString(),
      pit: pit.toString(),
      vol: vol.toString(),
      per: per.toString(),
      aue: aue.toString(), // 使用配置中的音频格式
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000); // 30秒超时

    let response;
    try {
      response = await fetch(directApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('请求超时');
      }
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    // 检查返回的Content-Type
    const contentType = response.headers.get('content-type');
    
    if (contentType?.startsWith('audio/')) {
      // 成功返回音频数据
      return await response.blob();
    } else {
      // 返回的是JSON错误信息
      const errorText = await response.text();
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        throw new Error('语音合成失败: 未知错误');
      }
      throw new Error(`语音合成失败: ${errorJson.err_msg || '未知错误'} (err_no: ${errorJson.err_no})`);
    }
  }

  /**
   * 通过服务端代理调用百度语音合成API（回退方案）
   */
  private async speakViaProxy(
    text: string,
    spd: number,
    pit: number,
    vol: number,
    per: number
  ): Promise<Blob> {
    const { apiKey, secretKey } = BAIDU_SPEECH_CONFIG;
    const requestUrl = '/api/tts/baidu';
    console.log('📤 通过服务端代理发送语音合成请求:', {
      请求URL: requestUrl,
      当前域名: window.location.origin
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        spd,
        pit,
        vol,
        per,
        apiKey,  // 传递 API Key
        secretKey,  // 传递 Secret Key
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error_description || `请求失败: ${response.status}`);
    }

    // 获取音频数据
    return await response.blob();
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
    // 清理 URL 对象
    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
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

