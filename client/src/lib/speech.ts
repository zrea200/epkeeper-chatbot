/**
 * 语音识别和语音合成工具
 * 支持讯飞语音服务（优先）、百度语音服务和浏览器原生 Web Speech API
 */

import BAIDU_SPEECH_CONFIG from '@/config/speech-config';
import XUNFEI_SPEECH_CONFIG from '@/config/xunfei-speech-config';
import { 
  BaiduSpeechRecognizer, 
  BaiduSpeechSynthesizer 
} from './baidu-speech';
import {
  XunfeiSpeechRecognizer,
  XunfeiSpeechSynthesizer
} from './xunfei-speech';

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
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent.toLowerCase();
  const isWeChat = /micromessenger/.test(ua);
  
  // 添加调试日志
  console.log('🔍 检测微信环境:', {
    userAgent: ua,
    isWeChat: isWeChat,
    baiduEnabled: BAIDU_SPEECH_CONFIG.enabled
  });
  
  return isWeChat;
}

/**
 * 检测是否在移动端浏览器
 */
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
}

/**
 * 语音识别类（自动选择讯飞API、百度API或浏览器原生API）
 */
export class SpeechRecognizer {
  private recognizer: any;
  private useXunfei: boolean;
  private useBaidu: boolean;

  constructor() {
    const isWeChat = isWeChatBrowser();
    const isMobile = isMobileBrowser();
    const xunfeiEnabled = XUNFEI_SPEECH_CONFIG.enabled;
    const baiduEnabled = BAIDU_SPEECH_CONFIG.enabled;
    
    // 优先使用讯飞语音服务（配置启用）
    // 其次使用百度语音服务（配置启用 且 在微信内或移动端浏览器）
    this.useXunfei = xunfeiEnabled;
    this.useBaidu = !xunfeiEnabled && baiduEnabled && (isWeChat || isMobile);
    
    console.log('🎤 语音识别初始化:', {
      isWeChat: isWeChat,
      isMobile: isMobile,
      xunfeiEnabled: xunfeiEnabled,
      baiduEnabled: baiduEnabled,
      useXunfei: this.useXunfei,
      useBaidu: this.useBaidu,
      speechRecognitionSupported: isSpeechRecognitionSupported()
    });
    
    if (this.useXunfei) {
      try {
        console.log('🎤 使用讯飞语音识别服务');
        this.recognizer = new XunfeiSpeechRecognizer();
      } catch (error) {
        console.error('❌ 初始化讯飞语音识别失败，尝试回退到百度API:', error);
        this.useXunfei = false;
        // 尝试回退到百度API
        if (baiduEnabled && (isWeChat || isMobile)) {
          try {
            console.log('🎤 回退到百度语音识别服务');
            this.useBaidu = true;
            this.recognizer = new BaiduSpeechRecognizer();
          } catch (baiduError) {
            console.error('❌ 初始化百度语音识别也失败，回退到浏览器原生API:', baiduError);
            this.useBaidu = false;
            this.initBrowserRecognition();
          }
        } else {
          this.initBrowserRecognition();
        }
      }
    } else if (this.useBaidu) {
      try {
        console.log('🎤 使用百度语音识别服务');
        this.recognizer = new BaiduSpeechRecognizer();
      } catch (error) {
        console.error('❌ 初始化百度语音识别失败，回退到浏览器原生API:', error);
        this.useBaidu = false;
        this.initBrowserRecognition();
      }
    } else {
      this.initBrowserRecognition();
    }
  }

  /**
   * 初始化浏览器原生语音识别
   */
  private initBrowserRecognition() {
    console.log('🎤 使用浏览器原生语音识别');
    if (!isSpeechRecognitionSupported()) {
      const errorMsg = BAIDU_SPEECH_CONFIG.enabled 
        ? '当前浏览器不支持语音识别，请检查是否在微信环境中，或确认百度语音服务配置正确'
        : '当前浏览器不支持语音识别。如需在微信中使用，请启用百度语音服务（speech-config.ts 中设置 enabled: true）';
      throw new Error(errorMsg);
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    this.recognizer = new SpeechRecognition();
    
    // 配置识别器
    this.recognizer.lang = 'zh-CN';
    this.recognizer.continuous = false;
    this.recognizer.interimResults = false;
    this.recognizer.maxAlternatives = 1;
  }

  /**
   * 开始语音识别
   */
  start(onResult: (text: string) => void, onError?: (error: string) => void) {
    if (this.useXunfei || this.useBaidu) {
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
 * 语音合成类（自动选择讯飞API、百度API或浏览器原生API）
 */
export class SpeechSynthesizer {
  private synthesizer: any;
  private useXunfei: boolean;
  private useBaidu: boolean;

  constructor() {
    const isWeChat = isWeChatBrowser();
    const isMobile = isMobileBrowser();
    const xunfeiEnabled = XUNFEI_SPEECH_CONFIG.enabled;
    const baiduEnabled = BAIDU_SPEECH_CONFIG.enabled;
    const browserSupported = isSpeechSynthesisSupported();
    
    // 优先使用讯飞语音服务（配置启用）
    // 其次使用百度语音服务（配置启用 且 在微信内或移动端浏览器）
    // 如果浏览器不支持原生API，且百度服务已启用，也尝试使用百度服务
    this.useXunfei = xunfeiEnabled;
    this.useBaidu = !xunfeiEnabled && ((baiduEnabled && (isWeChat || isMobile)) || (baiduEnabled && !browserSupported));
    
    console.log('🔊 语音合成初始化:', {
      isWeChat: isWeChat,
      isMobile: isMobile,
      xunfeiEnabled: xunfeiEnabled,
      baiduEnabled: baiduEnabled,
      browserSupported: browserSupported,
      useXunfei: this.useXunfei,
      useBaidu: this.useBaidu
    });
    
    if (this.useXunfei) {
      try {
        console.log('🔊 使用讯飞语音合成服务');
        this.synthesizer = new XunfeiSpeechSynthesizer();
      } catch (error) {
        console.error('❌ 初始化讯飞语音合成失败，尝试回退到百度API:', error);
        this.useXunfei = false;
        // 尝试回退到百度API
        if (baiduEnabled && ((isWeChat || isMobile) || !browserSupported)) {
          try {
            console.log('🔊 回退到百度语音合成服务');
            this.useBaidu = true;
            this.synthesizer = new BaiduSpeechSynthesizer();
          } catch (baiduError) {
            console.error('❌ 初始化百度语音合成也失败:', baiduError);
            // 如果百度服务初始化失败，尝试回退到浏览器原生API
            if (browserSupported) {
              console.warn('⚠️ 回退到浏览器原生语音合成');
              this.useBaidu = false;
              this.initBrowserSynthesis();
            } else {
              // 浏览器不支持且服务都失败，抛出详细错误
              throw new Error(
                `语音合成服务初始化失败。${isWeChat ? '您在微信环境中，' : ''}请检查语音服务配置是否正确。` +
                `错误详情: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          }
        } else if (browserSupported) {
          console.warn('⚠️ 回退到浏览器原生语音合成');
          this.initBrowserSynthesis();
        } else {
          throw new Error(
            `语音合成服务初始化失败。请检查讯飞或百度语音服务配置是否正确。` +
            `错误详情: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } else if (this.useBaidu) {
      try {
        console.log('🔊 使用百度语音合成服务');
        this.synthesizer = new BaiduSpeechSynthesizer();
      } catch (error) {
        console.error('❌ 初始化百度语音合成失败:', error);
        // 如果百度服务初始化失败，尝试回退到浏览器原生API
        if (browserSupported) {
          console.warn('⚠️ 回退到浏览器原生语音合成');
          this.useBaidu = false;
          this.initBrowserSynthesis();
        } else {
          // 浏览器不支持且百度服务失败，抛出详细错误
          throw new Error(
            `语音合成服务初始化失败。${isWeChat ? '您在微信环境中，' : ''}请检查百度语音服务配置是否正确（API Key 和 Secret Key）。` +
            `错误详情: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    } else {
      this.initBrowserSynthesis();
    }
  }

  /**
   * 初始化浏览器原生语音合成
   */
  private initBrowserSynthesis() {
    console.log('🔊 使用浏览器原生语音合成');
    if (!isSpeechSynthesisSupported()) {
      // 如果浏览器不支持，给出详细的错误提示和解决方案
      const isWeChat = isWeChatBrowser();
      const baiduEnabled = BAIDU_SPEECH_CONFIG.enabled;
      
      let errorMsg = '当前浏览器不支持语音合成。';
      
      if (isWeChat) {
        errorMsg += '您在微信环境中，必须使用百度语音服务。';
        if (!baiduEnabled) {
          errorMsg += '请在 speech-config.ts 中设置 enabled: true 并配置正确的 API Key 和 Secret Key。';
        } else {
          errorMsg += '请检查百度语音服务配置是否正确（API Key 和 Secret Key）。';
        }
      } else if (!baiduEnabled) {
        errorMsg += '如需在微信中使用，请在 speech-config.ts 中设置 enabled: true 并配置百度语音服务。';
      }
      
      throw new Error(errorMsg);
    }
    this.synthesizer = window.speechSynthesis;
  }

  /**
   * 播报文本（支持角色音色）
   */
  speak(text: string, options?: {
    characterId?: string; // 角色ID，用于选择音色（仅讯飞API支持）
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onEnd?: () => void;
    onError?: (error: any) => void;
  }) {
    if (this.useXunfei) {
      // 讯飞API支持角色音色
      this.synthesizer.speak(text, {
        characterId: options?.characterId,
        onEnd: options?.onEnd,
        onError: options?.onError,
      });
    } else if (this.useBaidu) {
      // 百度API不支持角色音色，使用默认配置
      this.synthesizer.speak(text, {
        onEnd: options?.onEnd,
        onError: options?.onError,
      });
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
    if (this.useXunfei || this.useBaidu) {
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
    if (!this.useXunfei && !this.useBaidu && this.synthesizer) {
      return this.synthesizer.getVoices();
    }
    return [];
  }
}
