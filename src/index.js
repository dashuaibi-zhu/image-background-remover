/**
 * Remove Background - Cloudflare Worker
 * 纯内存处理，不依赖存储
 * 集成 Google OAuth + 定价页 + 个人中心 + FAQ + PayPal 支付
 */

// ==================== 积分包配置 ====================
const CREDIT_PACKS = {
  'basic':    { credits: 100,  price: 2.99,  name: '基础包 100积分' },
  'standard': { credits: 500,  price: 9.99,  name: '标准包 500积分' },
  'super':    { credits: 1000, price: 17.99, name: '超值包 1000积分' },
};

const SUBSCRIPTION_PLANS = {
  'basic':   { credits: 10,  price: 0.99, name: '基础版 10次/月' },
  'standard':{ credits: 30,  price: 1.99, name: '标准版 30次/月' },
  'premium': { credits: 80,  price: 3.99, name: '高级版 80次/月' },
};

// ==================== 公共导航栏 ====================
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
function homePage(user, credits) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Remove BG - 免费在线去除图片背景</title>
  <meta name="description" content="在线去除图片背景，支持 JPG/PNG/WebP，一键抠图，秒级处理。">
  <style>${commonStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="hero">
    <h1>Remove Background</h1>
    <p class="subtitle">一键去除图片背景，秒级处理</p>
    ${user ? `<p class="cta-hint">剩余 <strong>${credits}</strong> 次额度</p>` : '<p class="cta-hint">注册即送 <strong>3 次</strong>免费额度</p>'}
  </div>
  <div class="container">
    ${user && credits <= 0 ? `
    <div class="no-credits">
      <h3>🔒 额度已用完</h3>
      <p>购买积分包或订阅继续使用</p>
      <a href="/pricing" class="btn btn-primary">查看定价方案</a>
    </div>` : `
    <div class="upload-zone" id="uploadZone">
      <div class="icon">📷</div>
      <p>拖拽图片到这里，或点击上传</p>
      <p class="hint">支持 JPG / PNG / WebP</p>
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
        <button class="btn btn-secondary" id="resetBtn">🔄 继续处理</button>
      </div>
    </div>
    ${!user ? `
    <div class="login-prompt" id="loginPrompt" style="display:none">
      <div class="prompt-box">
        <h3>🔒 免费额度已用完</h3>
        <p>注册即送 3 次免费额度</p>
        <div class="prompt-actions">
          <a href="/auth/login" class="btn btn-primary">Google 登录</a>
          <a href="/pricing" class="btn btn-secondary">查看定价</a>
        </div>
      </div>
    </div>` : ''}
    `}
  </div>
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-box">
      <div class="spinner"></div>
      <p>正在消除背景中...</p>
      <p style="color:#999;font-size:0.85rem;margin-top:8px">请稍候，通常需要 5-15 秒</p>
    </div>
  </div>
  ${user && credits > 0 ? `
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
    uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });

    async function handleFile(file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showError('请上传 JPG / PNG / WebP 格式的图片'); return; }
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
          if (response.status === 402) { window.location.href = '/pricing'; throw new Error(data.error); }
          throw new Error(data.error || '处理失败');
        }
        resultImg.src = data.image;
        previewSection.classList.add('active');
        uploadZone.style.display = 'none';
      } catch (err) { showError(err.message); }
      finally { loadingOverlay.classList.remove('active'); }
    }
    downloadBtn.addEventListener('click', () => { const a = document.createElement('a'); a.href = resultImg.src; a.download = 'no-bg-' + Date.now() + '.png'; a.click(); });
    resetBtn.addEventListener('click', () => { previewSection.classList.remove('active'); uploadZone.style.display = ''; fileInput.value = ''; hideError(); location.reload(); });
    function showError(msg) { errorMsg.textContent = '❌ ' + msg; errorMsg.classList.add('active'); }
    function hideError() { errorMsg.classList.remove('active'); }
  </script>` : !user ? `
  <script>
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const errorMsg = document.getElementById('errorMsg');
    let freeUsed = parseInt(localStorage.getItem('freeUsed') || '0');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', () => { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', (e) => { e.preventDefault(); uploadZone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', (e) => { if (e.target.files.length > 0) handleFile(e.target.files[0]); });

    async function handleFile(file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showError('请上传 JPG / PNG / WebP 格式的图片'); return; }
      if (file.size > 2 * 1024 * 1024) { showError('图片大小不能超过 2MB'); return; }
      if (freeUsed >= 3) {
        document.getElementById('loginPrompt').style.display = 'block';
        uploadZone.style.display = 'none';
        return;
      }
      hideError();
      loadingOverlay.classList.add('active');
      try {
        const formData = new FormData();
        formData.append('image', file);
        const response = await fetch('/api/remove-bg', { method: 'POST', body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '处理失败');
        freeUsed++;
        localStorage.setItem('freeUsed', freeUsed);
        // Show result inline
        const previewSection = document.getElementById('previewSection') || createPreview();
        document.getElementById('originalImg').src = URL.createObjectURL(file);
        document.getElementById('resultImg').src = data.image;
        previewSection.classList.add('active');
        uploadZone.style.display = 'none';
      } catch (err) { showError(err.message); }
      finally { loadingOverlay.classList.remove('active'); }
    }
    function createPreview() {
      const div = document.createElement('div'); div.className = 'preview-section'; div.id = 'previewSection';
      div.innerHTML = '<div class="preview-grid"><div class="preview-card"><div class="label">原图 <span>🖼️</span></div><img id="originalImg" src="" alt="原图"></div><div class="preview-card"><div class="label">去背景 <span>✨</span></div><img id="resultImg" class="result-img" src="" alt="去背景结果"></div></div><div class="btn-group"><button class="btn btn-primary" id="downloadBtn">⬇️ 下载结果</button><button class="btn btn-secondary" onclick="location.reload()">🔄 继续处理</button></div>';
      document.querySelector('.container').appendChild(div);
      document.getElementById('downloadBtn').addEventListener('click', () => { const a = document.createElement('a'); a.href = document.getElementById('resultImg').src; a.download = 'no-bg-' + Date.now() + '.png'; a.click(); });
      return div;
    }
    function showError(msg) { errorMsg.textContent = '❌ ' + msg; errorMsg.classList.add('active'); }
    function hideError() { errorMsg.classList.remove('active'); }
  </script>` : ''}
</body>
</html>`;
}

// ==================== 定价页 ====================
function pricingPage(user, credits) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>定价 - Remove BG</title>
  <meta name="description" content="简单透明的定价，月订阅低至 $0.99/月。">
  <style>${commonStyles()}</style>
  <style>${pricingStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="pricing-header">
    <h1>选择适合你的方案</h1>
    <p class="subtitle">简单透明的定价，按需选择</p>
    ${user ? `<p class="cta-hint">当前剩余 <strong>${credits}</strong> 次额度</p>` : ''}
  </div>

  <div class="pricing-tabs">
    <button class="tab active" onclick="switchTab('subscription')">🔄 月订阅</button>
    <button class="tab" onclick="switchTab('credits')">💰 积分包</button>
  </div>

  <div class="pricing-container">
    <!-- 月订阅 -->
    <div class="pricing-grid" id="subscription-tab">
      <div class="pricing-card">
        <div class="plan-name">🥉 基础版</div>
        <div class="plan-price">$0.99<span>/月</span></div>
        <div class="plan-desc">10 次/月</div>
        <ul class="plan-features">
          <li>✅ 每月 10 次额度</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ JPG / PNG / WebP</li>
        </ul>
        ${user ? `<button class="btn btn-secondary btn-block" onclick="buyPack('sub-basic', 0.99)">订阅</button>` : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后订阅</a>'}
      </div>
      <div class="pricing-card featured">
        <div class="badge">⭐ 最受欢迎</div>
        <div class="plan-name">🥈 标准版</div>
        <div class="plan-price">$1.99<span>/月</span></div>
        <div class="plan-desc">30 次/月</div>
        <ul class="plan-features">
          <li>✅ 每月 30 次额度</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ 优先处理</li>
        </ul>
        ${user ? `<button class="btn btn-primary btn-block" onclick="buyPack('sub-standard', 1.99)">订阅</button>` : '<a href="/auth/login" class="btn btn-primary btn-block">登录后订阅</a>'}
      </div>
      <div class="pricing-card">
        <div class="plan-name">🥇 高级版</div>
        <div class="plan-price">$3.99<span>/月</span></div>
        <div class="plan-desc">80 次/月</div>
        <ul class="plan-features">
          <li>✅ 每月 80 次额度</li>
          <li>✅ 高清下载</li>
          <li>✅ 无水印</li>
          <li>✅ 优先处理</li>
        </ul>
        ${user ? `<button class="btn btn-secondary btn-block" onclick="buyPack('sub-premium', 3.99)">订阅</button>` : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后订阅</a>'}
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
        ${user ? `<button class="btn btn-secondary btn-block" onclick="buyPack('basic', 2.99)">购买</button>` : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后购买</a>'}
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
        ${user ? `<button class="btn btn-primary btn-block" onclick="buyPack('standard', 9.99)">购买</button>` : '<a href="/auth/login" class="btn btn-primary btn-block">登录后购买</a>'}
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
        ${user ? `<button class="btn btn-secondary btn-block" onclick="buyPack('super', 17.99)">购买</button>` : '<a href="/auth/login" class="btn btn-secondary btn-block">登录后购买</a>'}
      </div>
    </div>
  </div>

  <div class="trust-bar">
    <span>✅ 安全支付</span>
    <span>🔒 随时取消</span>
    <span>💯 7天退款保证</span>
    <span>🚫 不存储图片</span>
  </div>

  <div class="faq-section">
    <h2>❓ 常见问题</h2>
    <div class="faq-list">
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">积分包和订阅有什么区别？<span class="arrow">▸</span></div>
        <div class="faq-a">积分包是一次性购买，积分永不过期。月订阅每月自动续费，适合高频用户。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">积分会过期吗？<span class="arrow">▸</span></div>
        <div class="faq-a">不会。积分包购买后永不过期。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">如何取消订阅？<span class="arrow">▸</span></div>
        <div class="faq-a">随时在个人中心一键取消。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">图片会被保存吗？<span class="arrow">▸</span></div>
        <div class="faq-a">不会。所有图片纯内存处理，处理完立即销毁。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">支持哪些付款方式？<span class="arrow">▸</span></div>
        <div class="faq-a">目前支持 PayPal。</div>
      </div>
      <div class="faq-item" onclick="this.classList.toggle('open')">
        <div class="faq-q">可以退款吗？<span class="arrow">▸</span></div>
        <div class="faq-a">支持 7 天无理由退款。</div>
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

    async function buyPack(packId, price) {
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = '跳转中...';
      try {
        const res = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        // 跳转到 PayPal 支付页面
        window.location.href = data.approvalUrl;
      } catch (err) {
        alert('创建订单失败: ' + err.message);
        btn.disabled = false;
        btn.textContent = '购买';
      }
    }
  </script>
</body>
</html>`;
}

// ==================== 支付成功页 ====================
function successPage(user, credits, packName, amount) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>支付成功 - Remove BG</title>
  <style>${commonStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="container" style="max-width:500px;text-align:center;margin-top:60px">
    <div style="font-size:4rem;margin-bottom:20px">🎉</div>
    <h2 style="color:#333;margin-bottom:10px">支付成功！</h2>
    <p style="color:#666;margin-bottom:5px">${packName}</p>
    <p style="color:#667eea;font-size:1.5rem;font-weight:700;margin:15px 0">当前余额: ${credits} 次</p>
    <a href="/" class="btn btn-primary" style="margin-right:10px">开始使用</a>
    <a href="/dashboard" class="btn btn-secondary">个人中心</a>
  </div>
</body>
</html>`;
}

// ==================== 支付失败页 ====================
function cancelPage(user) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>支付取消 - Remove BG</title>
  <style>${commonStyles()}</style>
</head>
<body>
  ${navbar(user)}
  <div class="container" style="max-width:500px;text-align:center;margin-top:60px">
    <div style="font-size:4rem;margin-bottom:20px">😔</div>
    <h2 style="color:#333;margin-bottom:10px">支付已取消</h2>
    <p style="color:#666;margin-bottom:20px">未完成付款，如有问题请联系客服</p>
    <a href="/pricing" class="btn btn-primary" style="margin-right:10px">返回定价</a>
    <a href="/" class="btn btn-secondary">回到首页</a>
  </div>
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
    <p class="subtitle">关于 Remove BG 的一切</p>
  </div>
  <div class="container" style="max-width:700px">
    <div class="faq-list">
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">这个工具是做什么的？<span class="arrow">▸</span></div><div class="faq-a">Remove BG 是一款在线去除图片背景的工具，AI 自动识别前景，去除背景，输出透明底图。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">支持哪些图片格式？<span class="arrow">▸</span></div><div class="faq-a">支持 JPG、PNG、WebP。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">免费版有什么限制？<span class="arrow">▸</span></div><div class="faq-a">注册即送 3 次免费额度，用完需购买积分包或订阅。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">积分包和订阅有什么区别？<span class="arrow">▸</span></div><div class="faq-a">积分包一次性购买永不过期，月订阅每月自动续费更优惠。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">图片会被保存吗？<span class="arrow">▸</span></div><div class="faq-a">不会。所有图片纯内存处理，处理完立即销毁。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">支持哪些付款方式？<span class="arrow">▸</span></div><div class="faq-a">目前支持 PayPal。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">如何取消订阅？<span class="arrow">▸</span></div><div class="faq-a">随时在个人中心一键取消。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">可以退款吗？<span class="arrow">▸</span></div><div class="faq-a">支持 7 天无理由退款。</div></div>
      <div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">处理一张图需要多久？<span class="arrow">▸</span></div><div class="faq-a">通常 5-15 秒。</div></div>
    </div>
  </div>
</body>
</html>`;
}

// ==================== 个人中心 ====================
function dashboardPage(user, credits) {
  if (!user) return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/auth/login"></head><body></body></html>`;

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
    <div class="card user-card">
      <div class="user-avatar">
        <img src="${user.picture || ''}" alt="avatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23667eea%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2265%22 font-size=%2250%22 text-anchor=%22middle%22 fill=%22white%22>${(user.name || 'U').charAt(0).toUpperCase()}</text></svg>'">
      </div>
      <div class="user-info">
        <div class="user-name">${user.name || '用户'}</div>
        <div class="user-email">${user.email}</div>
      </div>
    </div>
    <div class="card">
      <h2>📊 我的额度</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${credits}</div>
          <div class="stat-label">剩余次数</div>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>💎 获取更多</h2>
      <p style="color:#666;margin-bottom:15px">额度用完后，购买积分包或订阅继续使用</p>
      <a href="/pricing" class="btn btn-primary">查看定价方案</a>
    </div>
  </div>
</body>
</html>`;
}

// ==================== Worker 主入口 ====================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // OAuth 路由
    if (url.pathname === '/auth/login') return handleLogin(request, env);
    if (url.pathname === '/auth/callback') return handleCallback(request, env);
    if (url.pathname === '/auth/logout') return handleLogout();

    // PayPal 支付路由
    if (url.pathname === '/api/paypal/create-order' && request.method === 'POST') {
      return handleCreateOrder(request, env);
    }
    if (url.pathname === '/api/paypal/capture-order' && request.method === 'POST') {
      return handleCaptureOrder(request, env);
    }
    if (url.pathname === '/paypal/success') return handlePaypalSuccess(request, env);
    if (url.pathname === '/paypal/cancel') {
      const user = await getUserFromCookie(request, env);
      return new Response(cancelPage(user), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // API 路由
    if (url.pathname === '/api/me') {
      const user = await getUserFromCookie(request, env);
      const credits = await getCredits(request, env);
      return Response.json(user ? { ...user, credits } : { logged_in: false });
    }
    if (url.pathname === '/api/remove-bg' && request.method === 'POST') {
      return handleRemoveBg(request, env);
    }
    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', timestamp: Date.now() });
    }

    // 页面路由
    const user = await getUserFromCookie(request, env);
    const credits = await getCredits(request, env);
    let html;
    switch (url.pathname) {
      case '/pricing': html = pricingPage(user, credits); break;
      case '/dashboard': html = dashboardPage(user, credits); break;
      case '/faq': html = faqPage(user); break;
      default: html = homePage(user, credits); break;
    }

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },
};

// ==================== PayPal 支付 ====================

// 获取 PayPal Access Token
async function getPaypalAccessToken(env) {
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  // 使用 Sandbox，上线时改为 https://api-m.paypal.com
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

// 创建订单
async function handleCreateOrder(request, env) {
  const user = await getUserFromCookie(request, env);
  if (!user) return Response.json({ error: '请先登录' }, { status: 401 });

  try {
    const { packId } = await request.json();

    // 查找套餐（积分包 或 订阅）
    let pack = CREDIT_PACKS[packId];
    let isSubscription = false;
    if (!pack) {
      pack = SUBSCRIPTION_PLANS[packId.replace('sub-', '')];
      isSubscription = true;
    }
    if (!pack) return Response.json({ error: '无效的套餐' }, { status: 400 });

    const accessToken = await getPaypalAccessToken(env);
    const origin = new URL(request.url).origin;

    const orderRes = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: pack.name,
          amount: { currency_code: 'USD', value: pack.price.toString() },
          custom_id: packId,
        }],
        application_context: {
          return_url: `${origin}/paypal/success?packId=${packId}`,
          cancel_url: `${origin}/paypal/cancel`,
          user_action: 'PAY_NOW',
          brand_name: 'Remove BG',
        },
      }),
    });

    const order = await orderRes.json();
    if (!order.id) return Response.json({ error: '创建订单失败: ' + JSON.stringify(order) }, { status: 500 });

    // 找到 approve 链接
    const approveLink = order.links.find(l => l.rel === 'approve');
    if (!approveLink) return Response.json({ error: '无法获取支付链接' }, { status: 500 });

    return Response.json({ orderId: order.id, approvalUrl: approveLink.href });
  } catch (error) {
    return Response.json({ error: '创建订单失败: ' + error.message }, { status: 500 });
  }
}

// 捕获订单（PayPal 回调）
async function handleCaptureOrder(request, env) {
  try {
    const { orderId } = await request.json();
    const accessToken = await getPaypalAccessToken(env);

    const captureRes = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const capture = await captureRes.json();
    if (capture.status !== 'COMPLETED') {
      return Response.json({ error: '支付未完成', details: capture }, { status: 400 });
    }

    // 从 custom_id 获取套餐信息
    const customId = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id ||
                     capture.purchase_units?.[0]?.custom_id;

    let pack = CREDIT_PACKS[customId];
    if (!pack) {
      pack = SUBSCRIPTION_PLANS[customId?.replace('sub-', '')];
    }

    return Response.json({ success: true, credits: pack?.credits || 0, name: pack?.name || '' });
  } catch (error) {
    return Response.json({ error: '捕获订单失败: ' + error.message }, { status: 500 });
  }
}

// 支付成功回调
async function handlePaypalSuccess(request, env) {
  const url = new URL(request.url);
  const packId = url.searchParams.get('packId');
  const token = url.searchParams.get('token'); // PayPal order ID

  const user = await getUserFromCookie(request, env);
  if (!user) return Response.redirect('/auth/login', 302);

  // 捕获支付
  try {
    const accessToken = await getPaypalAccessToken(env);
    const captureRes = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    const capture = await captureRes.json();

    if (capture.status === 'COMPLETED') {
      // 获取套餐
      let pack = CREDIT_PACKS[packId];
      if (!pack) pack = SUBSCRIPTION_PLANS[packId?.replace('sub-', '')];

      // 更新积分 Cookie
      const currentCredits = await getCredits(request, env);
      const newCredits = currentCredits + (pack?.credits || 0);
      const creditsCookie = await signData(JSON.stringify({ credits: newCredits, updated: Date.now() }), env);

      const html = successPage(user, newCredits, pack?.name || '套餐', pack?.price || 0);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': `credits=${creditsCookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${365 * 24 * 3600}`,
        },
      });
    }
  } catch (e) {
    console.error('Capture error:', e);
  }

  // 支付失败
  return new Response(cancelPage(user), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== 积分管理 ====================
async function getCredits(request, env) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return 3; // 新用户默认 3 次

  const match = cookieHeader.match(/credits=([^;]+)/);
  if (!match) return 3;

  try {
    const [dataB64, sig] = match[1].split('.');
    if (!dataB64 || !sig) return 3;
    const data = decodeURIComponent(escape(atob(dataB64)));

    // 验证签名
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.GOOGLE_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expectedSig = arrayBufferToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
    if (sig !== expectedSig) return 3;

    const parsed = JSON.parse(data);
    return parsed.credits || 0;
  } catch { return 3; }
}

// ==================== OAuth ====================
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

function handleLogin(request, env) {
  const url = new URL(request.url);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${url.origin}/auth/callback`,
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
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/auth/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return new Response('授权失败', { status: 400 });

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userRes.json();
    if (!userInfo.email) return new Response('授权失败', { status: 400 });

    const userData = { email: userInfo.email, name: userInfo.name, picture: userInfo.picture };
    const sessionCookie = await signData(JSON.stringify(userData), env);

    return new Response(null, {
      status: 302,
      headers: {
        Location: '/dashboard',
        'Set-Cookie': `session=${sessionCookie}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
      },
    });
  } catch (error) {
    return new Response('授权失败: ' + error.message, { status: 500 });
  }
}

function handleLogout() {
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': 'session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    },
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
  const [dataB64, sig] = match[1].split('.');
  if (!dataB64 || !sig) return null;
  try {
    const data = decodeURIComponent(escape(atob(dataB64)));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(env.GOOGLE_CLIENT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    if (sig !== arrayBufferToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(data)))) return null;
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

    const imageBuffer = await file.arrayBuffer();
    const removeBgFormData = new FormData();
    removeBgFormData.append('image_file', new Blob([imageBuffer], { type: file.type }), file.name);
    removeBgFormData.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST', headers: { 'X-Api-Key': API_KEY }, body: removeBgFormData,
    });

    if (!response.ok) {
      if (response.status === 402) return Response.json({ error: 'API 额度已用完' }, { status: 402 });
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
