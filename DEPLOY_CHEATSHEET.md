# 🚀 部署速查卡

## 一条命令搞定（99%的情况）

```bash
docker compose up -d --build
```

---

## 完整流程

### 1️⃣ 首次部署
```bash
cd /home/zrea/epkeeper-chatbot
docker compose up -d --build
```

### 2️⃣ 修改代码后重新部署
```bash
docker compose up -d --build
```

### 3️⃣ 查看日志
```bash
docker compose logs -f
```

### 4️⃣ 停止服务
```bash
docker compose down
```

---

## 访问地址
- http://localhost:51872

---

## 常见问题

**Q: 构建太慢？**
```bash
# 确认使用了缓存（不要加 --no-cache）
docker compose up -d --build
```

**Q: 配置未生效？**
```bash
# 使用完全清理重建
./redeploy-clean.sh
```

**Q: 端口被占用？**
```bash
# 修改 docker-compose.yml 中的端口
ports:
  - "你的端口:3000"
```

---

详细文档见：`QUICK_DEPLOY.md`

