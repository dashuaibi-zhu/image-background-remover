/**
 * Remove Background - Cloudflare Worker
 * 纯内存处理，不依赖存储
 * 调用 remove.bg API 去除图片背景
 */

// 前端 HTML 页面（内嵌）
const HTML_PAGE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>背景消除工具</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    h1 { color: white; font-size: 2rem; margin-bottom: 10px; text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
    .subtitle { color: rgba(255,255,255,0.8); margin-bottom: 30px; font-size: 0.95rem; }
    .container {
      background: white;
      border-radius: 20px;
      padding: 30px;
      max-width: 900px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .upload-zone {
      border: 3px dashed #ddd;
      border-radius: 16px;
      padding: 50px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background: #fafafa;
    }
    .upload-zone:hover, .upload-zone.dragover { border-color: #667eea; background: #f0f0ff; }
    .upload-zone .icon { font-size: 4rem; margin-bottom: 15px; }
    .upload-zone p { color: #666; font-size: 1.1rem; }
    .upload-zone .hint { color: #999; font-size: 0.85rem; margin-top: 8px; }
    #fileInput { display: none; }
    .preview-section { display: none; margin-top: 25px; }
    .preview-section.active { display: block; }
    .preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .preview-card {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }
    .preview-card .label {
      background: #f5f5f5;
      padding: 10px 15px;
      font-weight: 600;
      color: #333;
      font-size: 0.9rem;
    }
    .preview-card .label span { color: #667eea; }
    .preview-card img {
      width: 100%;
      height: 300px;
      object-fit: contain;
      background: #f9f9f9;
      display: block;
    }
    .result-img {
      background-image:
        linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
        linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
        linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    }
    .loading-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 100;
      justify-content: center;
      align-items: center;
    }
    .loading-overlay.active { display: flex; }
    .loading-box {
      background: white;
      padding: 40px;
      border-radius: 16px;
      text-align: center;
    }
    .spinner {
      width: 50px; height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .btn-group { display: flex; gap: 12px; margin-top: 20px; justify-content: center; }
    .btn {
      padding: 12px 28px;
      border: none;
      border-radius: 10px;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.3s;
      font-weight: 600;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102,126,234,0.4); }
    .btn-secondary { background: #f0f0f0; color: #333; }
    .btn-secondary:hover { background: #e0e0e0; }
    .error-msg {
      display: none;
      background: #fff5f5;
      border: 1px solid #feb2b2;
      color: #c53030;
      padding: 15px 20px;
      border-radius: 10px;
      margin-top: 15px;
      text-align: center;
    }
    .error-msg.active { display: block; }
    @media (max-width: 600px) {
      .preview-grid { grid-template-columns: 1fr; }
      .upload-zone { padding: 30px; }
      h1 { font-size: 1.5rem; }
    }
  </style>
</head>
<body>
  <h1>背景消除工具</h1>
  <p class="subtitle">上传图片，一键去除背景</p>
  <div class="container">
    <div class="upload-zone" id="uploadZone">
      <div class="icon">📷</div>
      <p>拖拽图片到这里，或点击上传</p>
      <p class="hint">支持 JPG / PNG / WebP，最大 10MB</p>
      <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp">
    </div>
    <div class="error-msg" id="errorMsg"></div>
    <div class="preview-section" id="previewSection">
      <div class="preview-grid">
        <div class="preview-card">
          <div class="label">原图 <span>🖼️</span></div>
          <img id="originalImg" src="" alt="原图">
        </div>
        <div class="preview-card">
          <div class="label">去背景 <span>✨</span></div>
          <img id="resultImg" class="result-img" src="" alt="去背景结果">
        </div>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" id="downloadBtn">⬇️ 下载结果</button>
        <button class="btn btn-secondary" id="resetBtn">🔄 重新上传</button>
      </div>
    </div>
  </div>
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-box">
      <div class="spinner"></div>
      <p>正在消除背景中...</p>
      <p style="color:#999;font-size:0.85rem;margin-top:8px">请稍候，通常需要 5-15 秒</p>
    </div>
  </div>
  <script>
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const previewSection = document.getElementById('previewSection');
    const originalImg = document.getElementById('originalImg');
    const resultImg = document.getElementById('resultImg');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorMsg = document.getElementById('errorMsg');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });

    async function handleFile(file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showError('请上传 JPG / PNG / WebP 格式的图片'); return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError('图片大小不能超过 10MB'); return;
      }
      hideError();
      const reader = new FileReader();
      reader.onload = (e) => { originalImg.src = e.target.result; };
      reader.readAsDataURL(file);
      loadingOverlay.classList.add('active');
      try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch('/api/remove-bg', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '处理失败');
        resultImg.src = data.image;
        previewSection.classList.add('active');
        uploadZone.style.display = 'none';
      } catch (err) {
        showError(err.message);
      } finally {
        loadingOverlay.classList.remove('active');
      }
    }

    downloadBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = resultImg.src;
      link.download = 'no-bg-' + Date.now() + '.png';
      link.click();
    });

    resetBtn.addEventListener('click', () => {
      previewSection.classList.remove('active');
      uploadZone.style.display = '';
      fileInput.value = '';
      hideError();
    });

    function showError(msg) {
      errorMsg.textContent = '❌ ' + msg;
      errorMsg.classList.add('active');
    }
    function hideError() { errorMsg.classList.remove('active'); }
  </script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API 路由：去除背景
    if (url.pathname === '/api/remove-bg' && request.method === 'POST') {
      return handleRemoveBg(request, env);
    }

    // 健康检查
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // 返回前端页面
    return new Response(HTML_PAGE, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};

async function handleRemoveBg(request, env) {
  try {
    // 获取 API Key
    const API_KEY = env.REMOVE_BG_API_KEY;
    if (!API_KEY) {
      return Response.json(
        { error: 'API Key 未配置，请通过 wrangler secret put REMOVE_BG_API_KEY 设置' },
        { status: 500 }
      );
    }

    // 解析上传的文件
    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: '请上传图片' }, { status: 400 });
    }

    // 验证文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: '只支持 JPG/PNG/WebP 格式' }, { status: 400 });
    }

    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: '图片大小不能超过 10MB' }, { status: 400 });
    }

    console.log(`[处理中] 文件: ${file.name}, 大小: ${(file.size / 1024).toFixed(1)}KB`);

    // 读取文件为 ArrayBuffer（纯内存处理）
    const imageBuffer = await file.arrayBuffer();

    // 构建请求到 remove.bg API
    const removeBgFormData = new FormData();
    removeBgFormData.append('image_file', new Blob([imageBuffer], { type: file.type }), file.name);
    removeBgFormData.append('size', 'auto');

    // 调用 remove.bg API
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': API_KEY,
      },
      body: removeBgFormData,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 402) {
        return Response.json({ error: '免费额度已用完，请更换 API Key 或升级套餐' }, { status: 402 });
      }
      if (status === 403) {
        return Response.json({ error: 'API Key 无效，请检查配置' }, { status: 403 });
      }
      return Response.json({ error: `API 返回错误: ${status}` }, { status });
    }

    // 读取结果为 ArrayBuffer
    const resultBuffer = await response.arrayBuffer();
    console.log(`[完成] 原始: ${(file.size / 1024).toFixed(1)}KB → 结果: ${(resultBuffer.byteLength / 1024).toFixed(1)}KB`);

    // 转为 base64 返回（纯内存，不存储）
    const base64 = arrayBufferToBase64(resultBuffer);

    return Response.json({
      success: true,
      image: `data:image/png;base64,${base64}`,
    });
  } catch (error) {
    console.error('[错误]', error.message);
    return Response.json({ error: '处理失败，请稍后重试: ' + error.message }, { status: 500 });
  }
}

// ArrayBuffer 转 Base64（适配 Workers 环境）
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
