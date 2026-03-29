/**
 * Remove Background - Cloudflare Worker
 * 纯内存处理，不依赖存储
 * 集成 Google OAuth 登录 + 定价页 + 个人中心 + FAQ
 */

// ==================== 路由 ====================
const ROUTES = {
  '/': 'home',
  '/pricing': 'pricing',
  '/dashboard': 'dashboard',
  '/faq': 'faq',
};

// ==================== 前端页面 ====================

// 公共导航栏
function navbar(user) {
  return `
  <nav class="navbar">
    <a href="/" class="logo">✨ Remove BG</a>
    <div class="nav-links">
      <a href="/" class="nav-link">首页</a>
      <a href="/pricing" class="nav-link">定价</a>
      <a href="/faq" class="nav-link">FAQ</a>
      ${user ? `
        <a href="/dashboard" class="nav-link">个人中心</a>
        <a href="/auth/logout" class="btn-logout">退出</a>
      ` : `
        <a href="/auth/login" class="btn-google">
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          登录
        </a>
      `}
    </div>
  </nav>`;
}

// ==================== 首页 ====================
function homePage(user) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Remove BG - 免费在线去除图片背景</title>
  <meta name="description" content="免费在线去除图片背景，支持 JPG/PNG/WebP，一键抠图，秒级处理。">
  <style>${commonStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="hero">
    <h1>Remove Background</h1>
    <p class="subtitle">一键去除图片背景，秒级处理</p>
    ${!user ? '<p class="cta-hint">注册即送 <strong>3 次</strong>免费额度</p>' : ''}
  </div>
  <div class="container">
    <div class="upload-zone" id="uploadZone">
      <div class="icon">📷</div>
      <p>拖拽图片到这里，或点击上传</p>
      <p class="hint">支持 JPG / PNG / WebP，最大 ${user ? '5' : '2'}MB</p>
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
    ${!user ? `
    <div class="login-prompt" id="loginPrompt" style="display:none">
      <div class="prompt-box">
        <h3>🔒 免费额度已用完</h3>
        <p>注册即送 3 次免费额度，之后可购买积分包继续使用</p>
        <div class="prompt-actions">
          <a href="/auth/login" class="btn btn-primary">Google 登录</a>
          <a href="/pricing" class="btn btn-secondary">查看定价</a>
        </div>
      </div>
    </div>` : ''}
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
    const isLoggedIn = ${user ? 'true' : 'false'};

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault(); uploadZone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });

    async function handleFile(file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        showError('请上传 JPG / PNG / WebP 格式的图片'); return;
      }
      const maxSize = isLoggedIn ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
      if (file.size > maxSize) {
        showError('图片大小不能超过 ' + (isLoggedIn ? '5MB' : '2MB')); return;
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
        if (!response.ok) {
          if (response.status === 401) {
            const lp = document.getElementById('loginPrompt');
            if (lp) lp.style.display = 'block';
            uploadZone.style.display = 'none';
            throw new Error(data.error);
          }
          if (response.status === 402) {
            window.location.href = '/pricing';
            throw new Error(data.error);
          }
          throw new Error(data.error || '处理失败');
        }
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
    function showError(msg) { errorMsg.textContent = '❌ ' + msg; errorMsg.classList.add('active'); }
    function hideError() { errorMsg.classList.remove('active'); }
  </script>
</body>
</html>`;
}

// ==================== 定价页 ====================
function pricingPage(user) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>定价 - Remove BG</title>
  <meta name="description" content="简单透明的定价，按需选择适合你的方案。月订阅低至 $0.99/月。">
  <style>${commonStyles()}</style>
  <style>${pricingStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="pricing-header">
    <h1>选择适合你的方案</h1>
    <p class="subtitle">简单透明的定价，按需选择</p>
  </div>

  <!-- Tab 切换 -->
  <div class="pricing-tabs">
    <button class="tab active" onclick="switchTab('subscription')">🔄 月订阅</button>
    <button class="tab" onclick="switchTab('credits')">💰 积分包</button>
  </div>

  <div class="pricing-container">
    <!-- 月订阅 -->
    <div class="pricing-grid" id="subscription-tab">
      <!-- 基础版 -->
      <div class="pricing-card">
        <div class="plan-name">🥉 基础版</div>
        <div class="plan-price">$0.99<span>/月</span></div>
        <div class="plan-desc">10 次/月</div>
        <ul class="plan-features">
          <li>✅ 每月 10 次额度</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ 最大 5MB</li>
          <li>✅ JPG / PNG / WebP</li>
        </ul>
        ${user ? '<button class="btn btn-secondary btn-block" onclick="alert(\'PayPal 接入中，即将上线\')">订阅</button>' : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后订阅</a>'}
      </div>

      <!-- 标准版 -->
      <div class="pricing-card featured">
        <div class="badge">⭐ 最受欢迎</div>
        <div class="plan-name">🥈 标准版</div>
        <div class="plan-price">$1.99<span>/月</span></div>
        <div class="plan-desc">30 次/月</div>
        <ul class="plan-features">
          <li>✅ 每月 30 次额度</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ 最大 5MB</li>
          <li>✅ JPG / PNG / WebP</li>
          <li>✅ 优先处理</li>
        </ul>
        ${user ? '<button class="btn btn-primary btn-block" onclick="alert(\'PayPal 接入中，即将上线\')">订阅</button>' : '<a href="/auth/login" class="btn btn-primary btn-block">登录后订阅</a>'}
      </div>

      <!-- 高级版 -->
      <div class="pricing-card">
        <div class="plan-name">🥇 高级版</div>
        <div class="plan-price">$3.99<span>/月</span></div>
        <div class="plan-desc">80 次/月</div>
        <ul class="plan-features">
          <li>✅ 每月 80 次额度</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ 最大 10MB</li>
          <li>✅ JPG / PNG / WebP</li>
          <li>✅ 优先处理</li>
          <li>✅ 批量处理</li>
        </ul>
        ${user ? '<button class="btn btn-secondary btn-block" onclick="alert(\'PayPal 接入中，即将上线\')">订阅</button>' : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后订阅</a>'}
      </div>
    </div>

    <!-- 积分包 -->
    <div class="pricing-grid" id="credits-tab" style="display:none">
      <div class="pricing-card">
        <div class="plan-name">基础包</div>
        <div class="plan-price">$2.99</div>
        <div class="plan-desc">100 积分</div>
        <ul class="plan-features">
          <li>✅ 100 次去背景</li>
          <li>✅ 永不过期</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
        </ul>
        ${user ? '<button class="btn btn-secondary btn-block" onclick="alert(\'PayPal 接入中，即将上线\')">购买</button>' : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后购买</a>'}
      </div>
      <div class="pricing-card featured">
        <div class="badge">⭐ 最受欢迎</div>
        <div class="plan-name">标准包</div>
        <div class="plan-price">$9.99</div>
        <div class="plan-desc">500 积分</div>
        <ul class="plan-features">
          <li>✅ 500 次去背景</li>
          <li>✅ 永不过期</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ 省 $5</li>
        </ul>
        ${user ? '<button class="btn btn-primary btn-block" onclick="alert(\'PayPal 接入中，即将上线\')">购买</button>' : '<a href="/auth/login" class="btn btn-primary btn-block">登录后购买</a>'}
      </div>
      <div class="pricing-card">
        <div class="plan-name">超值包</div>
        <div class="plan-price">$17.99</div>
        <div class="plan-desc">1000 积分</div>
        <ul class="plan-features">
          <li>✅ 1000 次去背景</li>
          <li>✅ 永不过期</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ 省 $12</li>
        </ul>
        ${user ? '<button class="btn btn-secondary btn-block" onclick="alert(\'PayPal 接入中，即将上线\')">购买</button>' : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后购买</a>'}
      </div>
    </div>
  </div>

  <!-- 信任保障 -->
  <div class="trust-bar">
    <span>✅ 安全支付</span>
    <span>🔒 随时取消</span>
    <span>💯 7天退款保证</span>
    <span>🚫 不存储图片</span>
  </div>

  <!-- FAQ -->
  <div class="faq-section">
    <h2>❓ 常见问题</h2>
    <div class="faq-list">
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">积分包和订阅有什么区别？<span class="arrow">▸</span></div>
        <div class="faq-a">积分包是一次性购买，积分永不过期，适合偶尔使用的用户。月订阅是每月自动续费，适合高频用户，单价更优惠。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">积分会过期吗？<span class="arrow">▸</span></div>
        <div class="faq-a">不会。积分包购买后永不过期，随时使用。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">如何取消订阅？<span class="arrow">▸</span></div>
        <div class="faq-a">随时在个人中心一键取消，当月有效期内继续使用，不会自动续费。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">图片会被保存吗？<span class="arrow">▸</span></div>
        <div class="faq-a">不会。所有图片纯内存处理，处理完立即销毁，不存储任何数据，保护你的隐私。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">支持哪些付款方式？<span class="arrow">▸</span></div>
        <div class="faq-a">目前支持 PayPal，后续将支持信用卡等更多付款方式。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">免费版有什么限制？<span class="arrow">▸</span></div>
        <div class="faq-a">注册即送 3 次免费额度，用完后需要购买积分包或订阅才能继续使用。免费版最大支持 2MB 文件。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">可以退款吗？<span class="arrow">▸</span></div>
        <div class="faq-a">支持 7 天无理由退款，请联系客服处理。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">有 API 接口吗？<span class="arrow">▸</span></div>
        <div class="faq-a">MVP 阶段暂未开放 API，后续会推出 API 方案，敬请期待。</div>
      </div>
    </div>
  </div>

  <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      if (tab === 'subscription') {
        document.getElementById('subscription-tab').style.display = '';
        document.getElementById('credits-tab').style.display = 'none';
        document.querySelectorAll('.tab')[0].classList.add('active');
      } else {
        document.getElementById('subscription-tab').style.display = 'none';
        document.getElementById('credits-tab').style.display = '';
        document.querySelectorAll('.tab')[1].classList.add('active');
      }
    }
  </script>
</body>
</html>`;
}

// ==================== FAQ 页面 ====================
function faqPage(user) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FAQ - Remove BG</title>
  <style>${commonStyles()}</style>
  <style>${pricingStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="pricing-header">
    <h1>❓ 常见问题</h1>
    <p class="subtitle">关于 Remove BG 的一切，都在这里</p>
  </div>
  <div class="container" style="max-width:700px">
    <div class="faq-list">
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">这个工具是做什么的？<span class="arrow">▸</span></div>
        <div class="faq-a">Remove BG 是一款在线去除图片背景的工具。上传图片后，AI 会自动识别前景（人物、产品、动物等），去除背景，输出透明底图。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">支持哪些图片格式？<span class="arrow">▸</span></div>
        <div class="faq-a">支持 JPG、PNG、WebP 三种常见格式。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">免费版有什么限制？<span class="arrow">▸</span></div>
        <div class="faq-a">注册即送 3 次免费额度，用完后需要购买积分包或订阅才能继续使用。免费版最大支持 2MB 文件。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">积分包和订阅有什么区别？<span class="arrow">▸</span></div>
        <div class="faq-a">积分包是一次性购买，积分永不过期，适合偶尔使用的用户。月订阅是每月自动续费，适合高频用户，单价更优惠。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">积分会过期吗？<span class="arrow">▸</span></div>
        <div class="faq-a">不会。积分包购买后永不过期，随时使用。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">图片会被保存吗？安全吗？<span class="arrow">▸</span></div>
        <div class="faq-a">绝对安全。所有图片纯内存处理，处理完立即销毁，不存储任何数据。你的隐私是我们的第一优先级。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">支持哪些付款方式？<span class="arrow">▸</span></div>
        <div class="faq-a">目前支持 PayPal，后续将支持信用卡等更多付款方式。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">如何取消订阅？<span class="arrow">▸</span></div>
        <div class="faq-a">随时在个人中心一键取消，当月有效期内继续使用，不会自动续费。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">可以退款吗？<span class="arrow">▸</span></div>
        <div class="faq-a">支持 7 天无理由退款，请联系客服处理。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">有 API 接口吗？<span class="arrow">▸</span></div>
        <div class="faq-a">MVP 阶段暂未开放 API，后续会推出 API 方案，敬请期待。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">处理一张图需要多久？<span class="arrow">▸</span></div>
        <div class="faq-a">通常 5-15 秒，取决于图片大小和复杂度。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">对图片有什么要求？<span class="arrow">▸</span></div>
        <div class="faq-a">最好有清晰的前景（人物、产品、动物、车辆等），背景越简单效果越好。高分辨率图片效果更佳。</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ==================== 个人中心 ====================
function dashboardPage(user) {
  if (!user) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/auth/login"><style>${commonStyles()}</style></head><body>${navbar(null)}<div class="container" style="text-align:center;padding:60px"><p>正在跳转到登录页面...</p></div></body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>个人中心 - Remove BG</title>
  <style>${commonStyles()}</style>
  <style>${dashboardStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="dashboard">
    <h1>👤 个人中心</h1>

    <!-- 用户信息 -->
    <div class="card user-card">
      <div class="user-avatar">
        <img src="${user.picture || ''}" alt="avatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23667eea%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22>${(user.name || user.email || 'U').charAt(0).toUpperCase()}</text></svg>'">
      </div>
      <div class="user-info">
        <div class="user-name">${user.name || '用户'}</div>
        <div class="user-email">${user.email}</div>
        <div class="user-plan">🆓 免费用户</div>
      </div>
    </div>

    <!-- 使用统计 -->
    <div class="card">
      <h2>📊 使用统计</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">3</div>
          <div class="stat-label">剩余免费次数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">已使用</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">积分余额</div>
        </div>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:100%"></div>
      </div>
      <p class="progress-text">剩余 3 / 3 免费次数</p>
    </div>

    <!-- 套餐信息 -->
    <div class="card">
      <h2>💎 套餐</h2>
      <div class="plan-badge free">当前: 免费版</div>
      <p style="color:#666;margin:10px 0">免费次数用完后，购买积分包或订阅继续使用</p>
      <a href="/pricing" class="btn btn-primary">查看定价方案</a>
    </div>

    <!-- 使用记录 -->
    <div class="card">
      <h2>📋 最近记录</h2>
      <div class="usage-list">
        <div class="usage-empty">暂无使用记录</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ==================== 公共样式 ====================
function commonStyles() {
  return `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
  }
  .navbar {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
  }
  .navbar .logo { color: white; font-size: 1.3rem; font-weight: 700; text-decoration: none; }
  .nav-links { display: flex; align-items: center; gap: 20px; }
  .nav-link { color: rgba(255,255,255,0.85); text-decoration: none; font-size: 0.95rem; transition: color 0.2s; }
  .nav-link:hover { color: white; }
  .btn-google {
    display: inline-flex; align-items: center; gap: 8px;
    background: white; color: #333; padding: 8px 20px; border-radius: 8px;
    text-decoration: none; font-weight: 600; font-size: 0.9rem; transition: all 0.3s;
  }
  .btn-google:hover { box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
  .btn-logout {
    color: rgba(255,255,255,0.8); text-decoration: none; font-size: 0.85rem;
    border: 1px solid rgba(255,255,255,0.3); padding: 6px 16px; border-radius: 6px; transition: all 0.3s;
  }
  .btn-logout:hover { background: rgba(255,255,255,0.15); color: white; }
  .hero { text-align: center; color: white; padding: 40px 20px 10px; }
  .hero h1 { font-size: 2.5rem; text-shadow: 0 2px 10px rgba(0,0,0,0.2); margin-bottom: 10px; }
  .hero .subtitle { font-size: 1.1rem; color: rgba(255,255,255,0.85); }
  .hero .cta-hint { margin-top: 10px; font-size: 0.95rem; color: rgba(255,255,255,0.9); }
  .container { background: white; border-radius: 20px; padding: 30px; max-width: 900px; width: 100%; margin: 20px auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
  .upload-zone { border: 3px dashed #ddd; border-radius: 16px; padding: 50px; text-align: center; cursor: pointer; transition: all 0.3s; background: #fafafa; }
  .upload-zone:hover, .upload-zone.dragover { border-color: #667eea; background: #f0f0ff; }
  .upload-zone .icon { font-size: 4rem; margin-bottom: 15px; }
  .upload-zone p { color: #666; font-size: 1.1rem; }
  .upload-zone .hint { color: #999; font-size: 0.85rem; margin-top: 8px; }
  #fileInput { display: none; }
  .preview-section { display: none; margin-top: 25px; }
  .preview-section.active { display: block; }
  .preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .preview-card { border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
  .preview-card .label { background: #f5f5f5; padding: 10px 15px; font-weight: 600; color: #333; font-size: 0.9rem; }
  .preview-card .label span { color: #667eea; }
  .preview-card img { width: 100%; height: 300px; object-fit: contain; background: #f9f9f9; display: block; }
  .result-img { background-image: linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%); background-size: 20px 20px; background-position: 0 0, 0 10px, 10px -10px, -10px 0px; }
  .loading-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 100; justify-content: center; align-items: center; }
  .loading-overlay.active { display: flex; }
  .loading-box { background: white; padding: 40px; border-radius: 16px; text-align: center; }
  .spinner { width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-group { display: flex; gap: 12px; margin-top: 20px; justify-content: center; }
  .btn { padding: 12px 28px; border: none; border-radius: 10px; font-size: 1rem; cursor: pointer; transition: all 0.3s; font-weight: 600; text-decoration: none; display: inline-block; text-align: center; }
  .btn-primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102,126,234,0.4); }
  .btn-secondary { background: #f0f0f0; color: #333; }
  .btn-secondary:hover { background: #e0e0e0; }
  .btn-block { display: block; width: 100%; }
  .error-msg { display: none; background: #fff5f5; border: 1px solid #feb2b2; color: #c53030; padding: 15px 20px; border-radius: 10px; margin-top: 15px; text-align: center; }
  .error-msg.active { display: block; }
  .login-prompt { margin-top: 20px; }
  .prompt-box { background: linear-gradient(135deg, #667eea22, #764ba222); border: 2px solid #667eea44; border-radius: 16px; padding: 30px; text-align: center; }
  .prompt-box h3 { color: #333; margin-bottom: 10px; }
  .prompt-box p { color: #666; margin-bottom: 20px; }
  .prompt-actions { display: flex; gap: 12px; justify-content: center; }
  footer { text-align: center; color: rgba(255,255,255,0.6); padding: 30px; font-size: 0.85rem; }
  footer a { color: rgba(255,255,255,0.8); }
  @media (max-width: 600px) {
    .preview-grid { grid-template-columns: 1fr; }
    .upload-zone { padding: 30px; }
    .hero h1 { font-size: 1.8rem; }
    .nav-links { gap: 10px; }
    .nav-link { font-size: 0.85rem; }
  }`;
}

// ==================== 定价页样式 ====================
function pricingStyles() {
  return `
  .pricing-header { text-align: center; color: white; padding: 40px 20px 20px; }
  .pricing-header h1 { font-size: 2.2rem; text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
  .pricing-header .subtitle { color: rgba(255,255,255,0.8); margin-top: 8px; }
  .pricing-tabs { display: flex; justify-content: center; gap: 10px; margin: 20px 0; }
  .tab { padding: 10px 24px; border: 2px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: white; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.3s; }
  .tab.active { background: white; color: #667eea; border-color: white; }
  .tab:hover:not(.active) { background: rgba(255,255,255,0.2); }
  .pricing-container { max-width: 1000px; margin: 0 auto; padding: 0 20px 30px; }
  .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .pricing-card { background: white; border-radius: 16px; padding: 30px; text-align: center; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,0.15); transition: transform 0.3s; }
  .pricing-card:hover { transform: translateY(-5px); }
  .pricing-card.featured { border: 2px solid #667eea; transform: scale(1.05); }
  .pricing-card.featured:hover { transform: scale(1.05) translateY(-5px); }
  .badge { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 4px 16px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }
  .plan-name { font-size: 1.2rem; font-weight: 700; color: #333; margin-bottom: 10px; }
  .plan-price { font-size: 2.5rem; font-weight: 800; color: #333; }
  .plan-price span { font-size: 1rem; font-weight: 400; color: #999; }
  .plan-desc { color: #667eea; font-weight: 600; margin: 5px 0 20px; }
  .plan-features { list-style: none; text-align: left; margin-bottom: 25px; }
  .plan-features li { padding: 6px 0; color: #555; font-size: 0.95rem; }
  .trust-bar { display: flex; justify-content: center; gap: 30px; padding: 20px; color: rgba(255,255,255,0.8); font-size: 0.9rem; flex-wrap: wrap; }
  .faq-section { max-width: 700px; margin: 20px auto 40px; padding: 0 20px; }
  .faq-section h2 { color: white; text-align: center; margin-bottom: 20px; }
  .faq-list { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
  .faq-item { border-bottom: 1px solid #f0f0f0; cursor: pointer; }
  .faq-item:last-child { border-bottom: none; }
  .faq-q { padding: 18px 20px; font-weight: 600; color: #333; display: flex; justify-content: space-between; align-items: center; }
  .faq-q .arrow { transition: transform 0.3s; color: #999; }
  .faq-item.open .faq-q .arrow { transform: rotate(90deg); }
  .faq-a { padding: 0 20px 18px; color: #666; line-height: 1.6; display: none; }
  .faq-item.open .faq-a { display: block; }
  @media (max-width: 768px) {
    .pricing-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
    .pricing-card.featured { transform: none; }
    .pricing-card.featured:hover { transform: translateY(-5px); }
    .trust-bar { flex-direction: column; align-items: center; gap: 10px; }
  }`;
}

// ==================== 个人中心样式 ====================
function dashboardStyles() {
  return `
  .dashboard { max-width: 800px; margin: 0 auto; padding: 30px 20px 60px; }
  .dashboard h1 { color: white; font-size: 1.8rem; margin-bottom: 25px; text-shadow: 0 2px 10px rgba(0,0,0,0.2); }
  .card { background: white; border-radius: 16px; padding: 25px; margin-bottom: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.15); }
  .card h2 { font-size: 1.1rem; margin-bottom: 15px; color: #333; }
  .user-card { display: flex; align-items: center; gap: 20px; }
  .user-avatar img { width: 64px; height: 64px; border-radius: 50%; border: 3px solid #667eea22; }
  .user-name { font-size: 1.2rem; font-weight: 700; color: #333; }
  .user-email { color: #888; font-size: 0.9rem; margin-top: 2px; }
  .user-plan { margin-top: 6px; font-size: 0.85rem; color: #667eea; font-weight: 600; }
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
  .stat-item { text-align: center; padding: 15px; background: #f8f9ff; border-radius: 12px; }
  .stat-value { font-size: 2rem; font-weight: 800; color: #667eea; }
  .stat-label { font-size: 0.85rem; color: #888; margin-top: 4px; }
  .progress-bar { background: #f0f0f0; border-radius: 10px; height: 10px; overflow: hidden; }
  .progress-fill { background: linear-gradient(135deg, #667eea, #764ba2); height: 100%; border-radius: 10px; transition: width 0.5s; }
  .progress-text { text-align: center; color: #888; font-size: 0.85rem; margin-top: 8px; }
  .plan-badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; margin-bottom: 10px; }
  .plan-badge.free { background: #f0f0f0; color: #666; }
  .plan-badge.pro { background: linear-gradient(135deg, #667eea22, #764ba222); color: #667eea; }
  .usage-list { }
  .usage-empty { text-align: center; color: #ccc; padding: 30px; }
  @media (max-width: 600px) {
    .user-card { flex-direction: column; text-align: center; }
    .stats-grid { grid-template-columns: 1fr; }
  }`;
}

// ==================== Worker 主入口 ====================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // OAuth 路由
    if (url.pathname === '/auth/login') return handleLogin(request, env);
    if (url.pathname === '/auth/callback') return handleCallback(request, env);
    if (url.pathname === '/auth/logout') return handleLogout();

    // API 路由
    if (url.pathname === '/api/me') {
      const user = await getUserFromCookie(request, env);
      return Response.json(user || { logged_in: false });
    }
    if (url.pathname === '/api/remove-bg' && request.method === 'POST') {
      return handleRemoveBg(request, env);
    }
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // 页面路由
    const user = await getUserFromCookie(request, env);
    let html;
    switch (url.pathname) {
      case '/pricing': html = pricingPage(user); break;
      case '/dashboard': html = dashboardPage(user); break;
      case '/faq': html = faqPage(user); break;
      default: html = homePage(user); break;
    }

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  },
};

// ==================== OAuth 处理 ====================
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

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

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('授权失败', { status: 400 });

  try {
    const redirectUri = `${url.origin}/auth/callback`;
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri, grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return new Response('授权失败', { status: 400 });

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userRes.json();
    if (!userInfo.email) return new Response('授权失败', { status: 400 });

    const userData = { email: userInfo.email, name: userInfo.name, picture: userInfo.picture, verified: userInfo.verified_email };
    const cookieValue = await signData(JSON.stringify(userData), env);
    const cookie = `session=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}`;

    return new Response(null, { status: 302, headers: { Location: '/dashboard', 'Set-Cookie': cookie } });
  } catch (error) {
    return new Response('授权失败: ' + error.message, { status: 500 });
  }
}

function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: { Location: '/', 'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' },
  });
}

// ==================== Cookie 签名 ====================
async function signData(data, env) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.GOOGLE_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return `${btoa(unescape(encodeURIComponent(data)))}.${arrayBufferToHex(signature)}`;
}

async function getUserFromCookie(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/session=([^;]+)/);
  if (!match) return null;
  const [dataB64, signatureHex] = match[1].split('.');
  if (!dataB64 || !signatureHex) return null;
  try {
    const data = decodeURIComponent(escape(atob(dataB64)));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.GOOGLE_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expectedSig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    if (signatureHex !== arrayBufferToHex(expectedSig)) return null;
    return JSON.parse(data);
  } catch { return null; }
}

// ==================== 背景消除 ====================
async function handleRemoveBg(request, env) {
  try {
    const API_KEY = env.REMOVE_BG_API_KEY;
    if (!API_KEY) return Response.json({ error: 'API Key 未配置' }, { status: 500 });

    const formData = await request.formData();
    const file = formData.get('image');
    if (!file || !(file instanceof File)) return Response.json({ error: '请上传图片' }, { status: 400 });

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return Response.json({ error: '只支持 JPG/PNG/WebP' }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return Response.json({ error: '文件过大' }, { status: 400 });

    const imageBuffer = await file.arrayBuffer();
    const removeBgFormData = new FormData();
    removeBgFormData.append('image_file', new Blob([imageBuffer], { type: file.type }), file.name);
    removeBgFormData.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': API_KEY }, body: removeBgFormData,
    });

    if (!response.ok) {
      if (response.status === 402) return Response.json({ error: '额度已用完' }, { status: 402 });
      if (response.status === 403) return Response.json({ error: 'API Key 无效' }, { status: 403 });
      return Response.json({ error: `API 错误: ${response.status}` }, { status: response.status });
    }

    const resultBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(resultBuffer);
    return Response.json({ success: true, image: `data:image/png;base64,${base64}` });
  } catch (error) {
    return Response.json({ error: '处理失败: ' + error.message }, { status: 500 });
  }
}

// ==================== 工具函数 ====================
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
