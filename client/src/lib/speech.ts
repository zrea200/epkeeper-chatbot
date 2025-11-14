/**
 * 语音识别和语音合成工具
 * 仅支持讯飞语音服务
 */

import XUNFEI_SPEECH_CONFIG from '@/config/xunfei-speech-config';
import {
  XunfeiSpeechRecognizer,
  XunfeiSpeechSynthesizer
} from './xunfei-speech';

/**
 * 语音识别类（仅使用讯飞API）
 */
export class SpeechRecognizer {
  private recognizer: XunfeiSpeechRecognizer;

  constructor() {
    if (!XUNFEI_SPEECH_CONFIG.enabled) {
      throw new Error(
        '讯飞语音服务未启用。请在 xunfei-speech-config.ts 中设置 enabled: true 并配置正确的 API 密钥。'
      );
    }

    try {
      console.log('🎤 初始化讯飞语音识别服务');
      this.recognizer = new XunfeiSpeechRecognizer();
    } catch (error) {
      console.error('❌ 初始化讯飞语音识别失败:', error);
      throw new Error(
        `语音识别服务初始化失败。请检查讯飞语音服务配置是否正确。` +
        `错误详情: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 开始语音识别
   */
  start(onResult: (text: string) => void, onError?: (error: string) => void) {
    this.recognizer.start(onResult, onError);
  }

  /**
   * 停止语音识别
   */
  stop() {
    this.recognizer.stop();
  }

  /**
   * 获取当前是否正在监听
   */
  getIsListening(): boolean {
    return this.recognizer.getIsListening();
  }
}

/**
 * 语音合成类（仅使用讯飞API）
 */
export class SpeechSynthesizer {
  private synthesizer: XunfeiSpeechSynthesizer;

  constructor() {
    if (!XUNFEI_SPEECH_CONFIG.enabled) {
      throw new Error(
        '讯飞语音服务未启用。请在 xunfei-speech-config.ts 中设置 enabled: true 并配置正确的 API 密钥。'
      );
    }

    try {
      console.log('🔊 初始化讯飞语音合成服务');
      this.synthesizer = new XunfeiSpeechSynthesizer();
    } catch (error) {
      console.error('❌ 初始化讯飞语音合成失败:', error);
      throw new Error(
        `语音合成服务初始化失败。请检查讯飞语音服务配置是否正确。` +
        `错误详情: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 播报文本（支持角色音色）
   */
  async speak(text: string, options?: {
    characterId?: string; // 角色ID，用于选择音色
    onEnd?: () => void;
    onError?: (error: any) => void;
  }) {
    try {
      // 先停止当前所有正在播放的音频，避免多个音频同时播放
      this.stop();
      
      // 讯飞API支持角色音色，需要await异步调用
      await this.synthesizer.speak(text, {
        characterId: options?.characterId,
        onEnd: options?.onEnd,
        onError: options?.onError,
      });
    } catch (error: any) {
      console.error('❌ 语音合成调用失败:', error);
      // 如果是自动播放策略错误，静默处理
      if (error?.message?.includes('user didn\'t interact') || error?.name === 'NotAllowedError') {
        console.warn('⚠️ 自动播放被阻止（需要用户交互），这是正常的浏览器行为');
        options?.onEnd?.();
        return;
      }
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * 停止播报
   */
  stop() {
    this.synthesizer.stop();
  }

  /**
   * 暂停播报
   */
  pause() {
    this.synthesizer.pause();
  }

  /**
   * 恢复播报
   */
  resume() {
    this.synthesizer.resume();
  }

  /**
   * 获取当前是否正在播报
   */
  getIsSpeaking(): boolean {
    return this.synthesizer.getIsSpeaking();
  }
}
