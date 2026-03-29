# Remove BG Worker

Cloudflare Workers 版背景消除服务，纯内存处理，不依赖存储。

## 特性

- ✅ 纯内存处理，不写入任何存储
- ✅ 直接调用 remove.bg API
- ✅ 前端内嵌，单文件部署
- ✅ 支持拖拽上传、实时预览
- ✅ 支持 JPG / PNG / WebP 格式

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 配置 API Key

```bash
npx wrangler secret put REMOVE_BG_API_KEY
# 输入你的 remove.bg API Key
```

### 4. 本地开发

```bash
npm run dev
```

### 5. 部署

```bash
npm run deploy
```

## 技术说明

- **请求体限制**：免费版 Worker 限制 100KB，付费版支持更大文件
- **CPU 时间**：免费版 10ms，付费版 30s（图片处理建议付费版）
- **内存**：128MB，足够处理大多数图片
- **超时**：remove.bg API 通常 5-15 秒返回

## 注意事项

1. 免费版 Worker 有请求体大小限制（100KB），大图片需要升级到付费版
2. 图片完全在内存中处理，不会存储到任何地方
3. API Key 通过 Wrangler Secret 安全存储，不会暴露在代码中
