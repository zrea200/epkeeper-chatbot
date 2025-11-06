/**
 * 语音识别和语音合成工具
 * 支持百度语音服务（推荐，微信内可用）和浏览器原生 Web Speech API
 */

import BAIDU_SPEECH_CONFIG from '@/config/speech-config';
import { 
  BaiduSpeechRecognizer, 
  BaiduSpeechSynthesizer 
} from './baidu-speech';

// 检查浏览器是否支持语音识别
export function isSpeechRecognitionSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

// 检查浏览器是否支持语音合成
export function isSpeechSynthesisSupported(): boolean {
  return 'speechSynthesis' in window;
}

/**
 * 检测是否在微信环境
 */
function isWeChatBrowser(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  return /micromessenger/.test(ua);
}

/**
 * 语音识别类（自动选择百度API或浏览器原生API）
 */
export class SpeechRecognizer {
  private recognizer: any;
  private useBaidu: boolean;

  constructor() {
    // 优先使用百度语音服务（配置启用 且 在微信内）
    this.useBaidu = BAIDU_SPEECH_CONFIG.enabled && isWeChatBrowser();
    
    if (this.useBaidu) {
      console.log('🎤 使用百度语音识别服务（微信环境）');
      this.recognizer = new BaiduSpeechRecognizer();
    } else {
      console.log('🎤 使用浏览器原生语音识别');
      if (!isSpeechRecognitionSupported()) {
        throw new Error('当前浏览器不支持语音识别');
      }

      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      this.recognizer = new SpeechRecognition();
      
      // 配置识别器
      this.recognizer.lang = 'zh-CN';
      this.recognizer.continuous = false;
      this.recognizer.interimResults = false;
      this.recognizer.maxAlternatives = 1;
    }
  }

  /**
   * 开始语音识别
   */
  start(onResult: (text: string) => void, onError?: (error: string) => void) {
    if (this.useBaidu) {
      this.recognizer.start(onResult, onError);
    } else {
      if (this.recognizer.isListening) {
        return;
      }

      // 设置事件监听
      this.recognizer.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      };

      this.recognizer.onerror = (event: any) => {
        onError?.(event.error);
      };
      
      try {
        this.recognizer.start();
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        onError?.('启动语音识别失败');
      }
    }
  }

  /**
   * 停止语音识别
   */
  stop() {
    if (this.recognizer) {
      this.recognizer.stop();
    }
  }

  /**
   * 获取当前是否正在监听
   */
  getIsListening(): boolean {
    return this.recognizer?.getIsListening?.() || false;
  }
}

/**
 * 语音合成类（自动选择百度API或浏览器原生API）
 */
export class SpeechSynthesizer {
  private synthesizer: any;
  private useBaidu: boolean;

  constructor() {
    // 优先使用百度语音服务（配置启用 且 在微信内）
    this.useBaidu = BAIDU_SPEECH_CONFIG.enabled && isWeChatBrowser();
    
    if (this.useBaidu) {
      console.log('🔊 使用百度语音合成服务（微信环境）');
      this.synthesizer = new BaiduSpeechSynthesizer();
    } else {
      console.log('🔊 使用浏览器原生语音合成');
      if (!isSpeechSynthesisSupported()) {
        throw new Error('当前浏览器不支持语音合成');
      }
      this.synthesizer = window.speechSynthesis;
    }
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
    if (this.useBaidu) {
      this.synthesizer.speak(text, options);
    } else {
      // 停止当前播报
      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      
      // 配置语音参数
      utterance.lang = options?.lang || 'zh-CN';
      utterance.rate = options?.rate || 1.0;
      utterance.pitch = options?.pitch || 1.0;
      utterance.volume = options?.volume || 1.0;

      // 设置事件监听
      utterance.onend = () => {
        options?.onEnd?.();
      };

      utterance.onerror = (event) => {
        options?.onError?.(event);
      };

      // 开始播报
      this.synthesizer.speak(utterance);
    }
  }

  /**
   * 停止播报
   */
  stop() {
    if (this.useBaidu) {
      this.synthesizer?.stop();
    } else {
      this.synthesizer?.cancel();
    }
  }

  /**
   * 暂停播报
   */
  pause() {
    if (this.synthesizer) {
      this.synthesizer.pause();
    }
  }

  /**
   * 恢复播报
   */
  resume() {
    if (this.synthesizer) {
      this.synthesizer.resume();
    }
  }

  /**
   * 获取当前是否正在播报
   */
  getIsSpeaking(): boolean {
    return this.synthesizer?.getIsSpeaking?.() || false;
  }

  /**
   * 获取可用的语音列表（仅浏览器原生API）
   */
  getVoices(): SpeechSynthesisVoice[] {
    if (!this.useBaidu && this.synthesizer) {
      return this.synthesizer.getVoices();
    }
    return [];
  }
}
