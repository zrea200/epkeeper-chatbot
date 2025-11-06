# 百度语音服务配置指南

## 🎯 为什么使用百度语音服务？

相比浏览器原生 Web Speech API，百度语音服务具有以下优势：

| 特性 | 百度语音服务 | Web Speech API |
|-----|------------|----------------|
| **微信兼容性** | ✅ 完美支持 | ❌ 不支持 |
| **识别准确率** | ✅ 95%+ | ⚠️ 一般 |
| **语音质量** | ✅ 专业音色 | ⚠️ 机械音 |
| **稳定性** | ✅ 稳定 | ⚠️ 依赖浏览器 |
| **免费额度** | ✅ 每日5万次 | ✅ 无限制 |

## 📝 获取百度语音服务密钥

### 1. 注册百度智能云账号

访问 [百度AI开放平台](https://ai.baidu.com/) 注册账号。

### 2. 创建语音技术应用

1. 登录后，进入 [控制台](https://console.bce.baidu.com/ai/#/ai/speech/overview/index)
2. 选择 "语音技术" → "概览"
3. 点击 "创建应用"
4. 填写应用信息：
   - 应用名称：电管家聊天机器人
   - 接口选择：勾选 "语音识别" 和 "语音合成"
   - 应用归属：个人
5. 提交创建

### 3. 获取 API Key 和 Secret Key

创建完成后，在应用列表中可以看到：
- **API Key**：用于调用API
- **Secret Key**：用于获取访问令牌

## ⚙️ 配置项目

### 方法一：直接修改配置文件（推荐）

编辑 `client/src/config/speech-config.ts` 文件：

```typescript
export const BAIDU_SPEECH_CONFIG = {
  enabled: true, // 启用百度语音服务
  
  // 填入你的密钥
  apiKey: '你的API_KEY',
  secretKey: '你的SECRET_KEY',
  
  // 其他配置保持默认即可
  recognition: {
    language: 'zh',
    rate: 16000,
    format: 'wav',
    channel: 1,
  },
  
  synthesis: {
    vol: 5,    // 音量 0-15
    spd: 5,    // 语速 0-15
    pit: 5,    // 音调 0-15
    per: 0,    // 音色：0-女声，1-男声，3-度逍遥，4-度丫丫
    aue: 6,    // 音频格式：6-wav
  },
};
```

### 方法二：通过环境变量（暂不支持）

> 注意：当前版本不支持环境变量配置，请使用方法一。

## 🎤 音色选择

百度语音合成支持多种音色，修改 `synthesis.per` 参数：

| 值 | 音色 | 说明 |
|----|------|------|
| 0 | 度小美 | 温柔女声（推荐） |
| 1 | 度小宇 | 成熟男声 |
| 3 | 度逍遥 | 情感男声 |
| 4 | 度丫丫 | 萌系女声 |
| 5 | 度小娇 | 甜美女声 |
| 103 | 度米朵 | 温柔女声 |
| 106 | 度博文 | 情感解说 |
| 110 | 度小童 | 儿童声 |
| 111 | 度小萌 | 萌系女声 |

## 🔄 自动切换机制

项目会自动检测运行环境：

- **微信内置浏览器**：自动使用百度语音服务
- **其他浏览器**：使用原生 Web Speech API（除非强制启用百度服务）

查看控制台日志确认使用的服务：
```
🎤 使用百度语音识别服务（微信环境）
🔊 使用百度语音合成服务（微信环境）
```

## 🔧 禁用百度语音服务

如果暂时不需要百度语音服务，修改配置：

```typescript
export const BAIDU_SPEECH_CONFIG = {
  enabled: false, // 禁用百度语音服务
  // ...
};
```

这样所有环境都会使用浏览器原生 Web Speech API。

## 💰 免费额度说明

百度语音服务提供免费额度：

- **语音识别**：每天 50,000 次
- **语音合成**：每天 100,000 字符

对于大多数小型项目完全够用。超出免费额度后：
- 语音识别：0.0035 元/次
- 语音合成：0.0028 元/100字符

## ❓ 常见问题

### Q1: 微信内无法识别语音？

**A**: 检查配置：
1. 确认 `BAIDU_SPEECH_CONFIG.enabled = true`
2. 确认填入了正确的 API Key 和 Secret Key
3. 检查百度控制台的接口调用次数是否正常

### Q2: 提示 "获取 Access Token 失败"？

**A**: 可能的原因：
- API Key 或 Secret Key 错误
- 网络连接问题
- 百度服务器暂时不可用

### Q3: 语音质量不好？

**A**: 尝试调整参数：
- 提高 `synthesis.vol` 增加音量
- 降低 `synthesis.spd` 减慢语速
- 更换 `synthesis.per` 尝试其他音色

### Q4: 想在所有浏览器都使用百度服务？

**A**: 修改 `client/src/lib/speech.ts` 文件：

```typescript
// 将这行
this.useBaidu = BAIDU_SPEECH_CONFIG.enabled && isWeChatBrowser();

// 改为（强制使用百度服务）
this.useBaidu = BAIDU_SPEECH_CONFIG.enabled;
```

## 📚 相关文档

- [百度语音识别文档](https://ai.baidu.com/ai-doc/SPEECH/Vk38lxily)
- [百度语音合成文档](https://ai.baidu.com/ai-doc/SPEECH/Qk38y8lrl)
- [百度AI开放平台](https://ai.baidu.com/)

