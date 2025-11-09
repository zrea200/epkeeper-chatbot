import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { createBaiduSpeechAPIFromEnv, BaiduSpeechAPI } from "./baidu-speech-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建百度语音API实例（单例）
let baiduSpeechAPI: BaiduSpeechAPI | null = null;

function getBaiduSpeechAPI(): BaiduSpeechAPI {
  if (!baiduSpeechAPI) {
    try {
      baiduSpeechAPI = createBaiduSpeechAPIFromEnv();
    } catch (error: any) {
      console.error("初始化百度语音API失败:", error.message);
      throw error;
    }
  }
  return baiduSpeechAPI;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // 请求日志中间件（用于调试，放在最前面）
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      console.log(`[REQUEST] ${req.method} ${req.path}`, {
        query: req.query,
        hasBody: req.method === 'POST',
        contentType: req.headers['content-type']
      });
    }
    next();
  });

  // 简单的 CORS 处理，便于在内外网/微信内调试
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // JSON 解析中间件（需要在路由之前注册）
  app.use(express.json({ limit: "10mb" }));

  // API 路由必须在静态文件服务之前注册，确保优先匹配
  // 使用 /api/* 前缀的路由，确保不会被静态文件服务拦截
  
  // 健康检查路由，用于测试API是否正常工作
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // 代理获取百度 Access Token，绕过微信 WebView 的网络限制
  app.get("/api/baidu/token", async (req, res) => {
    console.log(`[TOKEN] 收到Token请求: ${req.method} ${req.path}`, {
      query: req.query,
      hasApiKey: !!req.query.apiKey || !!process.env.BAIDU_API_KEY,
      hasSecretKey: !!req.query.secretKey || !!process.env.BAIDU_SECRET_KEY
    });
    try {
      const apiKey = (req.query.apiKey as string) || process.env.BAIDU_API_KEY || "";
      const secretKey = (req.query.secretKey as string) || process.env.BAIDU_SECRET_KEY || "";

      if (!apiKey || !secretKey) {
        res.status(400).json({ error: "missing_config", error_description: "缺少 API Key 或 Secret Key" });
        return;
      }

      const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`;

      const upstream = await fetch(url, { method: "GET" });
      const text = await upstream.text();

      res.status(upstream.status);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.send(text);
    } catch (err: any) {
      res.status(502).json({ error: "proxy_failed", error_description: err?.message || "代理调用失败" });
    }
  });

  // 接收音频并由服务端调用百度语音识别
  app.post("/api/asr/baidu", async (req, res) => {
    const startTime = Date.now();
    console.log(`[ASR] 收到语音识别请求: ${req.method} ${req.path}`, {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.headers['content-type'],
      userAgent: req.headers['user-agent']?.substring(0, 50)
    });

    try {
      const { base64, format = "wav", rate = 16000, channel = 1, language = "zh", apiKey: bodyApiKey, secretKey: bodySecretKey } = req.body || {};
      
      console.log(`[ASR] 解析请求参数:`, {
        hasBase64: !!base64,
        base64Length: base64 ? base64.length : 0,
        format,
        rate,
        channel,
        language,
        hasApiKeyInBody: !!bodyApiKey,
        hasSecretKeyInBody: !!bodySecretKey
      });
      
      if (!base64) {
        console.error("[ASR] 缺少音频数据");
        res.status(400).json({ error: "missing_audio", error_description: "缺少音频 base64" });
        return;
      }

      // 检查API配置：优先使用请求体中的，然后是查询参数，最后是环境变量
      const apiKey = bodyApiKey || (req.query.apiKey as string) || process.env.BAIDU_API_KEY || "";
      const secretKey = bodySecretKey || (req.query.secretKey as string) || process.env.BAIDU_SECRET_KEY || "";
      
      console.log(`[ASR] 检查API配置:`, {
        hasApiKey: !!apiKey,
        hasSecretKey: !!secretKey,
        apiKeyFromBody: !!bodyApiKey,
        apiKeyFromQuery: !!(req.query.apiKey as string),
        apiKeyFromEnv: !!process.env.BAIDU_API_KEY,
        secretKeyFromBody: !!bodySecretKey,
        secretKeyFromQuery: !!(req.query.secretKey as string),
        secretKeyFromEnv: !!process.env.BAIDU_SECRET_KEY
      });
      
      if (!apiKey || !secretKey) {
        console.error("[ASR] 缺少 API Key 或 Secret Key");
        res.status(400).json({ error: "missing_config", error_description: "缺少 API Key 或 Secret Key" });
        return;
      }

      // 如果实例不存在或配置变化，重新创建
      if (!baiduSpeechAPI) {
        baiduSpeechAPI = new BaiduSpeechAPI({
          apiKey,
          secretKey,
          cuid: "epkeeper-chatbot",
        });
      }

      // 解析 base64 音频数据
      const base64Data = base64.replace(/^data:[^,]*,/, "");
      const audioBuffer = Buffer.from(base64Data, "base64");

      // 根据 language 确定 devPid（1537=普通话，1737=英语）
      const devPid = language === "en" ? 1737 : 1537;

      // 调用语音识别API（包含QPS控制和自动重试）
      console.log(`[ASR] 开始调用百度API，音频大小: ${audioBuffer.length} bytes`);
      const text = await baiduSpeechAPI.speechToText(
        audioBuffer,
        format as "pcm" | "wav" | "amr" | "m4a",
        rate,
        devPid
      );

      const duration = Date.now() - startTime;
      console.log(`[ASR] 识别成功，耗时: ${duration}ms，结果: ${text.substring(0, 50)}`);
      res.json({ text, success: true });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[ASR] 语音识别失败，耗时: ${duration}ms`, {
        error: err?.message,
        stack: err?.stack?.substring(0, 200),
        name: err?.name
      });
      res.status(502).json({
        error: "asr_failed",
        error_description: err?.message || "识别调用失败",
      });
    }
  });

  // 语音合成接口（TTS）
  app.post("/api/tts/baidu", async (req, res) => {
    try {
      const { text, spd, pit, vol, per, apiKey: bodyApiKey, secretKey: bodySecretKey } = req.body || {};
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "missing_text", error_description: "缺少文本内容" });
        return;
      }

      // 检查API配置：优先使用请求体中的，然后是查询参数，最后是环境变量
      const apiKey = bodyApiKey || (req.query.apiKey as string) || process.env.BAIDU_API_KEY || "";
      const secretKey = bodySecretKey || (req.query.secretKey as string) || process.env.BAIDU_SECRET_KEY || "";
      if (!apiKey || !secretKey) {
        res.status(400).json({ error: "missing_config", error_description: "缺少 API Key 或 Secret Key" });
        return;
      }

      // 如果实例不存在或配置变化，重新创建
      if (!baiduSpeechAPI) {
        baiduSpeechAPI = new BaiduSpeechAPI({
          apiKey,
          secretKey,
          cuid: "epkeeper-chatbot",
        });
      }

      // 调用语音合成API（包含QPS控制和自动重试）
      const audioBuffer = await baiduSpeechAPI.textToSpeech(text, {
        spd: spd ?? 5,
        pit: pit ?? 5,
        vol: vol ?? 5,
        per: per ?? 0,
      });

      // 返回音频数据
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (err: any) {
      console.error("语音合成失败:", err);
      res.status(502).json({
        error: "tts_failed",
        error_description: err?.message || "合成调用失败",
      });
    }
  });

  // Serve static files from dist/public in production
  // 静态文件服务放在 API 路由之后，Express会自动跳过已匹配的路由
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  // 注册静态文件服务（Express会自动跳过已匹配的API路由）
  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all GET routes (excluding /api/*)
  // 注意：这个通配符路由必须在所有API路由之后
  // Express会按照注册顺序匹配路由，所以API路由会优先匹配
  app.get("*", (req, res, next) => {
    // 双重检查：确保不处理 API 路由（虽然理论上不应该到这里）
    if (req.path.startsWith("/api/")) {
      console.error(`[ERROR] API路由被通配符路由拦截: ${req.method} ${req.path}`);
      return res.status(404).json({ error: "api_not_found", error_description: `API路由未找到: ${req.path}` });
    }
    // 发送 index.html 用于前端路由
    res.sendFile(path.join(staticPath, "index.html"), (err) => {
      if (err) {
        console.error(`[ERROR] 发送index.html失败:`, err);
        next(err);
      }
    });
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
