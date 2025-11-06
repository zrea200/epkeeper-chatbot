# 配置文件说明

## 文件列表

### 1. `ai-config.ts` - AI 对话服务配置

配置 Langcore AI 对话接口：

```typescript
export const AI_CONFIG = {
  url: 'https://demo.langcore.cn/api/workflow/run/...',
  authorization: 'Bearer sk-...',
  enabled: true,  // 是否启用 AI 功能
  timeout: 30000,
};
```

- `enabled: false` - 使用本地关键词匹配
- `enabled: true` - 使用 AI 流式对话

---

### 2. `speech-config.ts` - 百度语音服务配置 🎤

配置百度语音识别和语音合成服务：

```typescript
export const BAIDU_SPEECH_CONFIG = {
  enabled: true,  // 是否启用百度语音服务
  
  // ⚠️ 需要填入你的密钥（从 https://ai.baidu.com/ 获取）
  apiKey: 'YOUR_BAIDU_API_KEY',
  secretKey: 'YOUR_BAIDU_SECRET_KEY',
  
  recognition: {
    language: 'zh',    // 语言
    rate: 16000,       // 采样率
    format: 'wav',     // 音频格式
    channel: 1,        // 声道数
  },
  
  synthesis: {
    vol: 5,   // 音量 0-15
    spd: 5,   // 语速 0-15
    pit: 5,   // 音调 0-15
    per: 0,   // 音色（0-女声，1-男声，4-萌系女声）
    aue: 6,   // 音频格式
  },
};
```

**重要说明：**
- ✅ 微信内会自动使用百度语音服务（需配置密钥）
- ✅ 其他浏览器使用原生 Web Speech API
- ✅ 免费额度：语音识别每天5万次，TTS每天10万字符

**快速开始：**
1. 访问 [百度AI开放平台](https://ai.baidu.com/)
2. 创建"语音技术"应用
3. 获取 API Key 和 Secret Key
4. 填入上述配置中

详细说明见：`docs/BAIDU_SPEECH_SETUP.md`

---

## 快速配置步骤

### Step 1: 配置 AI 对话（可选）

如果有自己的 AI 接口，修改 `ai-config.ts`：
- 填入接口地址和授权令牌
- 设置 `enabled: true`

### Step 2: 配置百度语音（推荐）

修改 `speech-config.ts`：
1. 获取百度语音服务密钥
2. 填入 `apiKey` 和 `secretKey`
3. 设置 `enabled: true`

### Step 3: 测试

在微信内打开应用，测试语音识别和语音播报功能。

---

## 环境切换

### 开发环境
```bash
# 禁用百度语音（使用浏览器原生API）
enabled: false

# 禁用 AI（使用本地关键词匹配）
AI_CONFIG.enabled: false
```

### 生产环境（微信内）
```bash
# 启用百度语音（推荐）
enabled: true
apiKey: 'your_key'
secretKey: 'your_secret'

# 启用 AI
AI_CONFIG.enabled: true
```

---

## 故障排查

### 语音识别不工作？

1. **检查配置**
   - `BAIDU_SPEECH_CONFIG.enabled = true`
   - API Key 和 Secret Key 正确

2. **检查控制台**
   - 查看是否输出：`🎤 使用百度语音识别服务（微信环境）`
   - 查看是否有错误信息

3. **检查权限**
   - 微信内需授权麦克风权限
   - 浏览器需 HTTPS 协议

### 语音合成不工作？

1. **检查配置**
   - `BAIDU_SPEECH_CONFIG.enabled = true`
   - API Key 和 Secret Key 正确

2. **检查网络**
   - 确保可以访问 `tsn.baidu.com`
   - 检查防火墙设置

---

## 更多帮助

- 📖 [百度语音配置指南](../../docs/BAIDU_SPEECH_SETUP.md)
- 🌐 [百度AI开放平台](https://ai.baidu.com/)
- 📝 [项目文档](../../README.md)

