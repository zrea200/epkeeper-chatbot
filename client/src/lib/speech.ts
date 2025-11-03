/**
 * 语音识别和语音合成工具
 * 使用 Web Speech API
 */

// 检查浏览器是否支持语音识别
export function isSpeechRecognitionSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

// 检查浏览器是否支持语音合成
export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * 语音识别类
 */
export class SpeechRecognizer {
  private recognition: any;
  private isListening: boolean = false;
  private onResultCallback?: (text: string) => void;
  private onErrorCallback?: (error: string) => void;

  constructor() {
    if (!isSpeechRecognitionSupported()) {
      throw new Error('当前浏览器不支持语音识别');
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // 配置识别器
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    // 设置事件监听
    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.onResultCallback?.(transcript);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      this.onErrorCallback?.(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };
  }

  /**
   * 开始语音识别
   */
  start(onResult: (text: string) => void, onError?: (error: string) => void) {
    if (this.isListening) {
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError;
    
    try {
      this.recognition.start();
      this.isListening = true;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      onError?.('启动语音识别失败');
    }
  }

  /**
   * 停止语音识别
   */
  stop() {
    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  /**
   * 获取当前是否正在监听
   */
  getIsListening(): boolean {
    return this.isListening;
  }
}

/**
 * 语音合成类
 */
export class SpeechSynthesizer {
  private synth: SpeechSynthesis;
  private isSpeaking: boolean = false;

  constructor() {
    if (!isSpeechSynthesisSupported()) {
      throw new Error('当前浏览器不支持语音合成');
    }

    this.synth = window.speechSynthesis;
  }

  /**
   * 播报文本
   */
  speak(text: string, options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onEnd?: () => void;
    onError?: (error: any) => void;
  }) {
    // 停止当前播报
    this.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // 配置语音参数
    utterance.lang = options?.lang || 'zh-CN';
    utterance.rate = options?.rate || 1.0;
    utterance.pitch = options?.pitch || 1.0;
    utterance.volume = options?.volume || 1.0;

    // 设置事件监听
    utterance.onstart = () => {
      this.isSpeaking = true;
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      options?.onEnd?.();
    };

    utterance.onerror = (event) => {
      this.isSpeaking = false;
      options?.onError?.(event);
    };

    // 开始播报
    this.synth.speak(utterance);
  }

  /**
   * 停止播报
   */
  stop() {
    if (this.isSpeaking) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }

  /**
   * 暂停播报
   */
  pause() {
    if (this.isSpeaking) {
      this.synth.pause();
    }
  }

  /**
   * 恢复播报
   */
  resume() {
    if (this.isSpeaking) {
      this.synth.resume();
    }
  }

  /**
   * 获取当前是否正在播报
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /**
   * 获取可用的语音列表
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.synth.getVoices();
  }
}
