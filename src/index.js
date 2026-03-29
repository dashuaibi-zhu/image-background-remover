/**
 * Remove Background - Cloudflare Worker
 * 纯内存处理，不依赖存储
 * 集成 Google OAuth 登录
 */

// ==================== 前端 HTML ====================
const HTML_PAGE = (user) => `<!DOCTYPE html>
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
    /* 顶部导航栏 */
    .navbar {
      width: 100%;
      max-width: 900px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .navbar .logo { color: white; font-size: 1.2rem; font-weight: 600; }
    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      color: white;
    }
    .user-info img {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.5);
    }
    .user-info .name { font-size: 0.9rem; }
    .btn-google {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      color: #333;
      padding: 8px 20px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.3s;
      border: none;
      cursor: pointer;
    }
    .btn-google:hover { box-shadow: 0 4px 15px rgba(0,0,0,0.2); transform: translateY(-1px); }
    .btn-google svg { width: 18px; height: 18px; }
    .btn-logout {
      background: rgba(255,255,255,0.15);
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      padding: 6px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      text-decoration: none;
      transition: all 0.3s;
    }
    .btn-logout:hover { background: rgba(255,255,255,0.25); }
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
    .usage-info {
      text-align: center;
      color: rgba(255,255,255,0.7);
      font-size: 0.85rem;
      margin-top: 15px;
    }
    @media (max-width: 600px) {
      .preview-grid { grid-template-columns: 1fr; }
      .upload-zone { padding: 30px; }
      h1 { font-size: 1.5rem; }
      .navbar { flex-direction: column; gap: 10px; }
    }
  </style>
</head>
<body>
  <!-- 导航栏 -->
  <div class="navbar">
    <div class="logo">✨ Remove BG</div>
    <div class="user-info">
      ${user ? `
        <img src="${user.picture || ''}" alt="avatar" onerror="this.style.display='none'">
        <span class="name">${user.name || user.email}</span>
        <a href="/auth/logout" class="btn-logout">退出</a>
      ` : `
        <a href="/auth/login" class="btn-google">
          <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Google 登录
        </a>
      `}
    </div>
  </div>

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

  ${user ? `<div class="usage-info">已登录: ${user.email}</div>` : ''}

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

// ==================== OAuth 配置 ====================
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// ==================== Worker 主入口 ====================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // OAuth 路由
    if (url.pathname === '/auth/login') {
      return handleLogin(request, env);
    }
    if (url.pathname === '/auth/callback') {
      return handleCallback(request, env);
    }
    if (url.pathname === '/auth/logout') {
      return handleLogout();
    }

    // API 路由：获取当前用户信息
    if (url.pathname === '/api/me') {
      const user = await getUserFromCookie(request, env);
      return Response.json(user || { logged_in: false });
    }

    // API 路由：去除背景
    if (url.pathname === '/api/remove-bg' && request.method === 'POST') {
      return handleRemoveBg(request, env);
    }

    // 健康检查
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // 返回前端页面（带用户信息）
    const user = await getUserFromCookie(request, env);
    return new Response(HTML_PAGE(user), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};

// ==================== OAuth 处理 ====================

// 登录：重定向到 Google
function handleLogin(request, env) {
  const url = new URL(request.url);
  const redirectUri = `${url.origin}/auth/callback`;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });

  return Response.redirect(`${GOOGLE_AUTH_URL}?${params}`, 302);
}

// 回调：接收 Google 授权码，换取用户信息
async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('授权失败：缺少 code 参数', { status: 400 });
  }

  try {
    const redirectUri = `${url.origin}/auth/callback`;

    // 用 code 换 access_token
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return new Response('授权失败：无法获取 access_token', { status: 400 });
    }

    // 用 access_token 获取用户信息
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const userInfo = await userRes.json();

    if (!userInfo.email) {
      return new Response('授权失败：无法获取用户信息', { status: 400 });
    }

    // 构建用户数据
    const userData = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      verified: userInfo.verified_email,
    };

    // 签名并设置 Cookie
    const cookieValue = await signData(JSON.stringify(userData), env);
    const cookie = `session=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;

    // 登录成功，重定向到首页
    return new Response(null, {
      status: 302,
      headers: {
        Location: '/',
        'Set-Cookie': cookie,
      },
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response('授权失败：' + error.message, { status: 500 });
  }
}

// 登出：清除 Cookie
function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
  });
}

// ==================== Cookie 签名/验证 ====================

// 签名数据（HMAC-SHA256）
async function signData(data, env) {
  const secret = env.GOOGLE_CLIENT_SECRET; // 用 client_secret 作为签名密钥
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureHex = arrayBufferToHex(signature);

  // 格式: base64(data).signature_hex
  const dataB64 = btoa(unescape(encodeURIComponent(data)));
  return `${dataB64}.${signatureHex}`;
}

// 验证 Cookie 并解析用户信息
async function getUserFromCookie(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/session=([^;]+)/);
  if (!match) return null;

  const cookieValue = match[1];
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;

  const [dataB64, signatureHex] = parts;

  try {
    // 验证签名
    const data = decodeURIComponent(escape(atob(dataB64)));
    const secret = env.GOOGLE_CLIENT_SECRET;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const expectedHex = arrayBufferToHex(expectedSig);

    if (signatureHex !== expectedHex) {
      return null; // 签名不匹配
    }

    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

// ==================== 背景消除 ====================
async function handleRemoveBg(request, env) {
  try {
    const API_KEY = env.REMOVE_BG_API_KEY;
    if (!API_KEY) {
      return Response.json({ error: 'API Key 未配置' }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('image');

    if (!file || !(file instanceof File)) {
      return Response.json({ error: '请上传图片' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return Response.json({ error: '只支持 JPG/PNG/WebP 格式' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: '图片大小不能超过 10MB' }, { status: 400 });
    }

    console.log(`[处理中] 文件: ${file.name}, 大小: ${(file.size / 1024).toFixed(1)}KB`);

    const imageBuffer = await file.arrayBuffer();

    const removeBgFormData = new FormData();
    removeBgFormData.append('image_file', new Blob([imageBuffer], { type: file.type }), file.name);
    removeBgFormData.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': API_KEY },
      body: removeBgFormData,
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 402) {
        return Response.json({ error: '免费额度已用完' }, { status: 402 });
      }
      if (status === 403) {
        return Response.json({ error: 'API Key 无效' }, { status: 403 });
      }
      return Response.json({ error: `API 错误: ${status}` }, { status });
    }

    const resultBuffer = await response.arrayBuffer();
    console.log(`[完成] 原始: ${(file.size / 1024).toFixed(1)}KB → 结果: ${(resultBuffer.byteLength / 1024).toFixed(1)}KB`);

    const base64 = arrayBufferToBase64(resultBuffer);
    return Response.json({ success: true, image: `data:image/png;base64,${base64}` });
  } catch (error) {
    console.error('[错误]', error.message);
    return Response.json({ error: '处理失败: ' + error.message }, { status: 500 });
  }
}

// ==================== 工具函数 ====================
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
