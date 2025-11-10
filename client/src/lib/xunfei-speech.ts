/**
 * 讯飞语音服务工具
 * 支持语音识别和语音合成（通过服务端代理）
 */

import XUNFEI_SPEECH_CONFIG from '@/config/xunfei-speech-config';

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
 */
function getSupportedMimeType(): string {
  const browserInfo = getBrowserInfo();
  console.log('🔍 浏览器环境检测:', browserInfo);
  
  const mimeTypes = [
    'audio/mp4',
    'audio/aac',
    'audio/mpeg',
    'audio/ogg',
    'audio/webm;codecs=opus',
    'audio/webm',
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

  console.warn('⚠️ 未检测到明确的音频格式支持，使用默认 audio/webm');
  return 'audio/webm';
}

/**
 * 讯飞语音识别类
 */
export class XunfeiSpeechRecognizer {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isListening: boolean = false;
  private onResultCallback?: (text: string) => void;
  private onErrorCallback?: (error: string) => void;
  private currentMimeType: string = 'audio/webm';

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
      console.log('🎤 开始语音识别（讯飞），环境信息:', browserInfo);
      
      // 请求麦克风权限
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints 
      });
      
      const audioTrack = stream.getAudioTracks()[0];
      const settings = audioTrack.getSettings();
      console.log('✅ 麦克风权限获取成功，音频参数:', {
        采样率: settings.sampleRate,
        声道数: settings.channelCount,
      });
      
      // 检测并使用支持的音频格式
      const mimeType = getSupportedMimeType();
      this.currentMimeType = mimeType;
      console.log('🎤 使用音频格式:', mimeType);
      
      // 创建 MediaRecorder
      let recorderCreated = false;
      const preferredMimeTypes = [
        mimeType,
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      
      for (const preferredType of preferredMimeTypes) {
        try {
          if (MediaRecorder.isTypeSupported(preferredType)) {
            this.mediaRecorder = new MediaRecorder(stream, {
              mimeType: preferredType,
              audioBitsPerSecond: 128000,
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
            audioBitsPerSecond: 128000,
          });
        } catch (recorderError: any) {
          console.error('❌ MediaRecorder 创建失败，使用最简配置:', recorderError);
          this.mediaRecorder = new MediaRecorder(stream);
        }
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

      const recordingStartTime = Date.now();
      
      // 录音结束
      this.mediaRecorder.onstop = async () => {
        try {
          const recordingDuration = Date.now() - recordingStartTime;
          console.log(`⏱️ 录音时长: ${recordingDuration}ms`);
          
          if (recordingDuration < 500) {
            console.warn('⚠️ 录音时长过短，可能影响识别准确率');
            this.onErrorCallback?.('录音时长过短，请至少录音0.5秒');
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          
          // 合并音频数据
          const audioBlob = new Blob(this.audioChunks, { type: this.currentMimeType });
          
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
          
          stream.getTracks().forEach(track => track.stop());
        } catch (error: any) {
          console.error('❌ 语音识别失败:', error);
          this.onErrorCallback?.(error.message || '识别失败');
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
   * 将音频转换为 WAV 格式
   */
  private async convertAudioToWav(audioBlob: Blob, stream: MediaStream): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async () => {
        try {
          const audioBuffer = await audioContext.decodeAudioData(fileReader.result as ArrayBuffer);
          
          const { rate } = XUNFEI_SPEECH_CONFIG.recognition;
          const sampleRate = rate;
          
          let processedBuffer = audioBuffer;
          if (audioBuffer.sampleRate !== sampleRate) {
            console.log(`🔄 重采样: ${audioBuffer.sampleRate}Hz -> ${sampleRate}Hz`);
            processedBuffer = await this.resampleAudio(audioBuffer, sampleRate);
          }
          
          processedBuffer = this.normalizeAudio(processedBuffer);
          
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
   * 重采样音频
   */
  private async resampleAudio(audioBuffer: AudioBuffer, targetSampleRate: number): Promise<AudioBuffer> {
    const sourceSampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = Math.round(audioBuffer.length * targetSampleRate / sourceSampleRate);
    
    const offlineContext = new OfflineAudioContext(numberOfChannels, length, targetSampleRate);
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);
    return await offlineContext.startRendering();
  }

  /**
   * 音频归一化
   */
  private normalizeAudio(audioBuffer: AudioBuffer): AudioBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    
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
    
    if (maxAmplitude > 0 && maxAmplitude < 0.5) {
      const gain = 0.8 / maxAmplitude;
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
    const format = 1;
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * numChannels * bytesPerSample);
    const view = new DataView(arrayBuffer);
    
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numChannels * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, length * numChannels * bytesPerSample, true);
    
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
   * 通过服务端代理调用讯飞语音识别API
   */
  private async recognizeAudio(audioBlob: Blob): Promise<string> {
    const base64Audio = await this.blobToBase64(audioBlob);
    const { format, rate } = XUNFEI_SPEECH_CONFIG.recognition;
    
    const base64Data = base64Audio.replace(/^data:[^,]*,/, '');

    console.log('📤 通过服务端代理发送语音识别请求（讯飞）:', {
      请求URL: '/api/asr/xunfei',
      当前域名: window.location.origin
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000);

    let response;
    try {
      response = await fetch('/api/asr/xunfei', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          rate,
          base64: base64Audio,
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
      });
      throw new Error(`响应格式错误: ${parseError.message}`);
    }
    
    console.log('📥 讯飞语音识别响应:', {
      text: result.text
    });
    
    if (result?.text) {
      console.log('✅ 语音识别成功（讯飞）:', result.text);
      return result.text;
    }
    
    const errorMsg = result?.error_description || result?.error || '识别失败';
    console.error('❌ 语音识别失败（讯飞）:', result);
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
   * 获取当前是否正在监听
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}

/**
 * 讯飞语音合成类
 */
export class XunfeiSpeechSynthesizer {
  private audio: HTMLAudioElement | null = null;
  private isSpeaking: boolean = false;
  private currentAudioUrl: string | null = null;

  /**
   * 播报文本（支持角色音色）
   */
  async speak(
    text: string,
    options?: {
      characterId?: string; // 角色ID，用于选择音色
      onEnd?: () => void;
      onError?: (error: any) => void;
    }
  ) {
    // 停止当前播报
    this.stop();

    try {
      const browserInfo = getBrowserInfo();
      console.log('🔊 开始请求语音合成（讯飞）:', { 
        textLength: text.length,
        characterId: options?.characterId,
        browserInfo: browserInfo
      });

      // 根据角色ID获取音色配置
      const characterId = options?.characterId || 'escort';
      const voiceConfig = XUNFEI_SPEECH_CONFIG.characterVoices[characterId as keyof typeof XUNFEI_SPEECH_CONFIG.characterVoices] 
        || XUNFEI_SPEECH_CONFIG.characterVoices.escort;

      console.log('🎵 使用音色配置:', {
        角色ID: characterId,
        音色: voiceConfig.vcn,
        语速: voiceConfig.speed,
        音调: voiceConfig.pitch,
      });

      // 通过服务端代理调用讯飞API
      const audioBlob = await this.speakViaProxy(text, voiceConfig);
      console.log('✅ 语音合成成功（讯飞），音频大小:', `${(audioBlob.size / 1024).toFixed(2)} KB`);

      // 清理之前的 URL 对象
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
      }
      this.currentAudioUrl = URL.createObjectURL(audioBlob);

      // 创建音频元素
      this.audio = new Audio(this.currentAudioUrl);
      this.audio.preload = 'auto';
      
      // 等待音频加载完成
      await new Promise<void>((resolve, reject) => {
        if (!this.audio) {
          reject(new Error('音频元素未创建'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('音频加载超时'));
        }, 10000);

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
        });
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
          this.currentAudioUrl = null;
        }
        options?.onError?.(new Error(errorMsg));
      };

      // 尝试播放音频
      try {
        const playPromise = this.audio.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        console.log('✅ 语音播放已启动');
      } catch (playError: any) {
        console.error('❌ 语音播放启动失败:', playError);
        if (this.currentAudioUrl) {
          URL.revokeObjectURL(this.currentAudioUrl);
          this.currentAudioUrl = null;
        }
        const errorMsg = playError.message || '无法播放音频，请检查是否在用户交互中触发';
        throw new Error(errorMsg);
      }
    } catch (error: any) {
      console.error('❌ 讯飞语音合成失败:', error);
      this.isSpeaking = false;
      const errorMsg = error?.message || '语音合成服务失败';
      options?.onError?.(error instanceof Error ? error : new Error(errorMsg));
    }
  }

  /**
   * 通过服务端代理调用讯飞语音合成API
   */
  private async speakViaProxy(
    text: string,
    voiceConfig: typeof XUNFEI_SPEECH_CONFIG.characterVoices.escort
  ): Promise<Blob> {
    const requestUrl = '/api/tts/xunfei';
    console.log('📤 通过服务端代理发送语音合成请求（讯飞）:', {
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
        vcn: voiceConfig.vcn,
        speed: voiceConfig.speed,
        pitch: voiceConfig.pitch,
        volume: voiceConfig.volume,
        aue: voiceConfig.aue,
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
   * 获取当前是否正在播报
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

