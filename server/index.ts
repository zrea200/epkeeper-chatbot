import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { config } from "dotenv";
import compression from "compression";
import { createXunfeiSpeechAPIFromEnv, XunfeiSpeechAPI } from "./xunfei-speech-api.js";

// 加载 .env 文件
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.resolve(__dirname, "..", ".env") });

// 创建讯飞语音API实例（单例）
let xunfeiSpeechAPI: XunfeiSpeechAPI | null = null;

function getXunfeiSpeechAPI(): XunfeiSpeechAPI {
  if (!xunfeiSpeechAPI) {
    try {
      xunfeiSpeechAPI = createXunfeiSpeechAPIFromEnv();
    } catch (error: any) {
      console.error("初始化讯飞语音API失败:", error.message);
      throw error;
    }
  }
  return xunfeiSpeechAPI;
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

  // Gzip 压缩中间件（在路由之前注册，优化静态资源传输）
  // 对 JSON、HTML、CSS、JS 等文本资源进行压缩，可减少 60-70% 的传输大小
  app.use(compression({
    filter: (req, res) => {
      // 如果请求头中明确表示不接受压缩，则不压缩
      if (req.headers['x-no-compression']) {
        return false;
      }
      // 使用默认的压缩过滤器
      return compression.filter(req, res);
    },
    level: 6, // 压缩级别 1-9，6 是平衡性能和压缩率的推荐值
    threshold: 1024, // 只压缩大于 1KB 的响应
  }));

  // JSON 解析中间件（需要在路由之前注册）
  app.use(express.json({ limit: "10mb" }));

  // API 路由必须在静态文件服务之前注册，确保优先匹配
  // 使用 /api/* 前缀的路由，确保不会被静态文件服务拦截
  
  // 健康检查路由，用于测试API是否正常工作
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // NFC点位问答接口
  app.get("/api/nfc", (req, res) => {
    try {
      const point = parseInt(req.query.point as string);
      // 解码URL参数中的中文字符
      const avatar = decodeURIComponent(req.query.avatar as string);
      const question = decodeURIComponent(req.query.question as string);

      console.log('[NFC] 接收参数:', { point, avatar, question });

      if (!point || !avatar || !question) {
        res.status(400).json({
          error: "missing_params",
          error_description: "缺少必要参数：point、avatar、question",
        });
        return;
      }

      // 读取统一的数据文件
      const qaDatabasePath = path.resolve(__dirname, "..", "shared", "qa-database.json");
      const qaDatabase = JSON.parse(readFileSync(qaDatabasePath, "utf-8"));

      // 查找对应的点位
      const pointData = qaDatabase.nfcPoints?.find((p: any) => p.point === point && p.avatar === avatar);
      if (!pointData) {
        console.log('[NFC] 未找到点位:', { point, avatar, availablePoints: qaDatabase.nfcPoints?.map((p: any) => ({ point: p.point, avatar: p.avatar })) || [] });
        res.status(404).json({
          error: "point_not_found",
          error_description: `未找到点位 ${point} 的 ${avatar} 数据`,
        });
        return;
      }

      // 查找对应的问题（更灵活的匹配：去除标点、空格，忽略大小写）
      const normalizeQuestion = (q: string) => {
        return q.replace(/[，。？！、；：\s]/g, '').toLowerCase().trim();
      };
      
      const normalizedInputQuestion = normalizeQuestion(question);
      const questionIndex = pointData.questions.findIndex(
        (q: any) => {
          const normalizedQ = normalizeQuestion(q.question);
          return q.question === question || normalizedQ === normalizedInputQuestion;
        }
      );

      if (questionIndex === -1) {
        console.log('[NFC] 未找到问题:', { 
          inputQuestion: question, 
          normalizedInput: normalizedInputQuestion,
          availableQuestions: pointData.questions.map((q: any) => q.question)
        });
        res.status(404).json({
          error: "question_not_found",
          error_description: `未找到问题：${question}`,
        });
        return;
      }

      const questionData = pointData.questions[questionIndex];

      // 随机选择一个答案
      const randomAnswer = questionData.answers[Math.floor(Math.random() * questionData.answers.length)];

      // 获取下一个问题（循环）
      const nextQuestionIndex = (questionIndex + 1) % pointData.questions.length;
      const nextQuestion = pointData.questions[nextQuestionIndex].question;

      res.json({
        success: true,
        point,
        avatar,
        question,
        answer: randomAnswer,
        nextQuestion,
      });
    } catch (err: any) {
      console.error("NFC接口错误:", err);
      res.status(500).json({
        error: "server_error",
        error_description: err?.message || "服务器内部错误",
      });
    }
  });

  // NFC数据获取接口（用于前端获取推荐问题）
  app.get("/api/nfc-data", (req, res) => {
    try {
      const point = parseInt(req.query.point as string);
      const avatar = decodeURIComponent(req.query.avatar as string);

      if (!point || !avatar) {
        res.status(400).json({
          error: "missing_params",
          error_description: "缺少必要参数：point、avatar",
        });
        return;
      }

      // 读取统一的数据文件
      const qaDatabasePath = path.resolve(__dirname, "..", "shared", "qa-database.json");
      const qaDatabase = JSON.parse(readFileSync(qaDatabasePath, "utf-8"));

      // 查找对应的点位
      const pointData = qaDatabase.nfcPoints?.find((p: any) => p.point === point && p.avatar === avatar);
      if (!pointData) {
        res.status(404).json({
          error: "point_not_found",
          error_description: `未找到点位 ${point} 的 ${avatar} 数据`,
        });
        return;
      }

      res.json({
        success: true,
        point,
        avatar,
        pointData,
      });
    } catch (err: any) {
      console.error("NFC数据接口错误:", err);
      res.status(500).json({
        error: "server_error",
        error_description: err?.message || "服务器内部错误",
      });
    }
  });

  // 讯飞语音识别接口（ASR）
  app.post("/api/asr/xunfei", async (req, res) => {
    const startTime = Date.now();
    console.log(`[ASR-Xunfei] 收到语音识别请求: ${req.method} ${req.path}`, {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      contentType: req.headers['content-type'],
    });

    try {
      const { base64, format = "wav", rate = 16000 } = req.body || {};
      
      if (!base64) {
        console.error("[ASR-Xunfei] 缺少音频数据");
        res.status(400).json({ error: "missing_audio", error_description: "缺少音频 base64" });
        return;
      }

      // 从环境变量读取 API 配置（生产环境必须配置）
      // ⚠️ 注意：如果遇到鉴权失败，可能是 API_KEY 和 API_SECRET 的值需要交换
      // 工作版本 (e92e84a) 中这两个值在环境变量和代码默认值中都是反的，但能正常工作
      const appId = process.env.XUNFEI_APP_ID;
      let apiKey = process.env.XUNFEI_API_KEY;
      let apiSecret = process.env.XUNFEI_API_SECRET;
      
      if (!appId || !apiKey || !apiSecret) {
        console.error("[ASR-Xunfei] 缺少 API 配置，请设置环境变量 XUNFEI_APP_ID、XUNFEI_API_KEY、XUNFEI_API_SECRET");
        res.status(400).json({ error: "missing_config", error_description: "缺少讯飞 API 配置（AppID、APIKey、APISecret），请检查环境变量" });
        return;
      }

      // 如果设置了环境变量 XUNFEI_SWAP_KEYS=true，则交换 API_KEY 和 API_SECRET
      // 这用于调试：如果遇到鉴权失败，可以尝试交换这两个值
      if (process.env.XUNFEI_SWAP_KEYS === 'true') {
        console.warn("[ASR-Xunfei] 检测到 XUNFEI_SWAP_KEYS=true，交换 API_KEY 和 API_SECRET");
        [apiKey, apiSecret] = [apiSecret, apiKey];
      }

      // 如果实例不存在或配置变化，重新创建
      if (!xunfeiSpeechAPI) {
        xunfeiSpeechAPI = new XunfeiSpeechAPI({
          appId,
          apiKey,
          apiSecret,
        });
      }

      // 解析 base64 音频数据
      const base64Data = base64.replace(/^data:[^,]*,/, "");
      const audioBuffer = Buffer.from(base64Data, "base64");

      // 调用语音识别API
      console.log(`[ASR-Xunfei] 开始调用讯飞API，音频大小: ${audioBuffer.length} bytes`);
      const text = await xunfeiSpeechAPI.speechToText(
        audioBuffer,
        format as "wav" | "pcm",
        rate
      );

      const duration = Date.now() - startTime;
      console.log(`[ASR-Xunfei] 识别成功，耗时: ${duration}ms，结果: ${text.substring(0, 50)}`);
      res.json({ text, success: true });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      console.error(`[ASR-Xunfei] 语音识别失败，耗时: ${duration}ms`, {
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

  // 讯飞语音合成接口（TTS）
  app.post("/api/tts/xunfei", async (req, res) => {
    try {
      const { text, vcn, speed, pitch, volume, aue } = req.body || {};
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "missing_text", error_description: "缺少文本内容" });
        return;
      }

      // 从环境变量读取 API 配置（生产环境必须配置）
      // ⚠️ 注意：如果遇到鉴权失败，可能是 API_KEY 和 API_SECRET 的值需要交换
      // 工作版本 (e92e84a) 中这两个值在环境变量和代码默认值中都是反的，但能正常工作
      const appId = process.env.XUNFEI_APP_ID;
      let apiKey = process.env.XUNFEI_API_KEY;
      let apiSecret = process.env.XUNFEI_API_SECRET;
      
      if (!appId || !apiKey || !apiSecret) {
        console.error("[TTS-Xunfei] 缺少 API 配置，请设置环境变量 XUNFEI_APP_ID、XUNFEI_API_KEY、XUNFEI_API_SECRET");
        res.status(400).json({ error: "missing_config", error_description: "缺少讯飞 API 配置（AppID、APIKey、APISecret），请检查环境变量" });
        return;
      }

      // 如果设置了环境变量 XUNFEI_SWAP_KEYS=true，则交换 API_KEY 和 API_SECRET
      // 这用于调试：如果遇到鉴权失败，可以尝试交换这两个值
      if (process.env.XUNFEI_SWAP_KEYS === 'true') {
        console.warn("[TTS-Xunfei] 检测到 XUNFEI_SWAP_KEYS=true，交换 API_KEY 和 API_SECRET");
        [apiKey, apiSecret] = [apiSecret, apiKey];
      }

      // 如果实例不存在或配置变化，重新创建
      if (!xunfeiSpeechAPI) {
        xunfeiSpeechAPI = new XunfeiSpeechAPI({
          appId,
          apiKey,
          apiSecret,
        });
      }

      // 调用语音合成API
      const resolvedAue: string = typeof aue === "string" && aue.trim().length > 0 ? aue : "lame";
      const audioBuffer = await xunfeiSpeechAPI.textToSpeech(text, {
        vcn: vcn || "xiaoyu", // 默认使用讯飞小宇（男声，基础发音人）
        speed: speed ?? 50,
        pitch: pitch ?? 50,
        volume: volume ?? 50,
        aue: resolvedAue,
      });

      // 返回音频数据
      const contentType =
        resolvedAue === "lame"
          ? "audio/mpeg"
          : resolvedAue === "wav"
          ? "audio/wav"
          : "application/octet-stream";

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Length", audioBuffer.length.toString());
      res.send(audioBuffer);
    } catch (err: any) {
      console.error("讯飞语音合成失败:", err);
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
  // 添加缓存头优化性能
  // 注意：compression 中间件需要在 express.static 之前注册才能压缩静态文件
  app.use(express.static(staticPath, {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0', // 生产环境缓存1年
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // 对带 hash 的资源设置长期缓存
      if (path.match(/\.[a-f0-9]{8,}\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|json|lottie)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|json|lottie)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1天
      }
      // 不设置 Content-Length，让 compression 中间件处理压缩
      // 如果设置了 Content-Length，compression 可能无法压缩
    },
  }));

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
