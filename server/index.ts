import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import crypto from "crypto";
import { createBaiduSpeechAPIFromEnv, BaiduSpeechAPI } from "./baidu-speech-api.js";
import { createXunfeiSpeechAPIFromEnv, XunfeiSpeechAPI } from "./xunfei-speech-api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建百度语音API实例（单例）
let baiduSpeechAPI: BaiduSpeechAPI | null = null;
// 创建讯飞语音API实例（单例）
let xunfeiSpeechAPI: XunfeiSpeechAPI | null = null;

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

  // 微信小程序登录接口（通过 code 换取 session_key 和 openid）
  app.post("/api/wechat/login", async (req, res) => {
    console.log(`[WECHAT] 收到登录请求: ${req.method} ${req.path}`);

    try {
      const { code } = req.body || {};

      if (!code) {
        res.status(400).json({
          error: "missing_code",
          error_description: "缺少 code 参数",
        });
        return;
      }

      const appId = process.env.WECHAT_APPID;
      const appSecret = process.env.WECHAT_APPSECRET;

      if (!appId || !appSecret) {
        res.status(500).json({
          error: "missing_config",
          error_description: "服务器未配置微信小程序 AppID 或 AppSecret",
        });
        return;
      }

      // 调用微信接口换取 session_key 和 openid
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.errcode) {
        console.error('[WECHAT] 登录失败:', data);
        res.status(400).json({
          error: "login_failed",
          error_description: data.errmsg || "登录失败",
        });
        return;
      }

      console.log('[WECHAT] 登录成功:', {
        openid: data.openid,
        hasSessionKey: !!data.session_key,
      });

      res.json({
        success: true,
        data: {
          openid: data.openid,
          session_key: data.session_key,
        },
      });
    } catch (err: any) {
      console.error("微信登录错误:", err);
      res.status(500).json({
        error: "server_error",
        error_description: err?.message || "服务器内部错误",
      });
    }
  });

  // 微信小程序手机号解密接口
  app.post("/api/wechat/decrypt-phone", async (req, res) => {
    console.log(`[WECHAT] 收到手机号解密请求: ${req.method} ${req.path}`);

    try {
      const { encryptedData, iv, sessionKey } = req.body || {};

      if (!encryptedData || !iv || !sessionKey) {
        res.status(400).json({
          error: "missing_params",
          error_description: "缺少必要参数：encryptedData、iv、sessionKey",
        });
        return;
      }

      // 解密手机号
      const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(sessionKey, 'base64'), Buffer.from(iv, 'base64'));
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      const phoneData = JSON.parse(decrypted);
      const phoneNumber = phoneData.phoneNumber;

      console.log('[WECHAT] 手机号解密成功:', {
        hasPhoneNumber: !!phoneNumber,
      });

      res.json({
        success: true,
        data: {
          phoneNumber: phoneNumber,
        },
      });
    } catch (err: any) {
      console.error("手机号解密错误:", err);
      res.status(500).json({
        error: "decrypt_failed",
        error_description: err?.message || "解密失败",
      });
    }
  });

  // 微信小程序用户信息存储接口
  app.post("/api/wechat/user", async (req, res) => {
    console.log(`[WECHAT] 收到用户信息存储请求: ${req.method} ${req.path}`, {
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });

    try {
      const { nickname, avatar, phoneNumber, openid, source } = req.body || {};

      // 验证必要字段
      if (!nickname && !openid) {
        res.status(400).json({
          error: "missing_params",
          error_description: "缺少必要参数：nickname 或 openid",
        });
        return;
      }

      // 这里可以将用户信息存储到数据库
      // 当前项目未使用数据库，可以存储到文件或内存中
      // 示例：存储到 JSON 文件（需要先创建 users.json 文件）
      const userData = {
        openid: openid || `temp_${Date.now()}`, // 如果没有 openid，生成临时 ID
        nickname: nickname || '',
        avatar: avatar || '',
        phoneNumber: phoneNumber || null,
        source: source || 'miniprogram',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('[WECHAT] 用户信息:', {
        openid: userData.openid,
        nickname: userData.nickname,
        hasAvatar: !!userData.avatar,
        hasPhoneNumber: !!userData.phoneNumber,
      });

      // TODO: 实际项目中应该存储到数据库
      // 这里先返回成功，实际存储逻辑可以根据需要实现
      // 例如：使用 SQLite、MongoDB、PostgreSQL 等

      res.json({
        success: true,
        message: "用户信息保存成功",
        data: {
          openid: userData.openid,
          nickname: userData.nickname,
        },
      });
    } catch (err: any) {
      console.error("微信用户信息存储错误:", err);
      res.status(500).json({
        error: "server_error",
        error_description: err?.message || "服务器内部错误",
      });
    }
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

      // 检查API配置：优先使用环境变量，如果没有则使用配置文件中的值（开发用）
      const appId = process.env.XUNFEI_APP_ID || "54c865b6";
      const apiKey = process.env.XUNFEI_API_KEY || "1e71234d7970325c2adf493bced1dc26";
      const apiSecret = process.env.XUNFEI_API_SECRET || "NDAxMDgxZjlhZWY4NGY0ZGIyNWY5YTVi";
      
      if (!appId || !apiKey || !apiSecret) {
        console.error("[ASR-Xunfei] 缺少 API 配置");
        res.status(400).json({ error: "missing_config", error_description: "缺少讯飞 API 配置（AppID、APIKey、APISecret）" });
        return;
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

      // 检查API配置：优先使用环境变量，如果没有则使用配置文件中的值（开发用）
      const appId = process.env.XUNFEI_APP_ID || "54c865b6";
      const apiKey = process.env.XUNFEI_API_KEY || "1e71234d7970325c2adf493bced1dc26";
      const apiSecret = process.env.XUNFEI_API_SECRET || "NDAxMDgxZjlhZWY4NGY0ZGIyNWY5YTVi";
      
      if (!appId || !apiKey || !apiSecret) {
        res.status(400).json({ error: "missing_config", error_description: "缺少讯飞 API 配置（AppID、APIKey、APISecret）" });
        return;
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
  app.use(express.static(staticPath, {
    maxAge: process.env.NODE_ENV === 'production' ? '1y' : '0', // 生产环境缓存1年
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // 对带 hash 的资源设置长期缓存
      if (path.match(/\.[a-f0-9]{8,}\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|json)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|json)$/i)) {
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1天
      }
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
