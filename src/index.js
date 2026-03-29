/**
 * Remove BG - Cloudflare Worker
 */
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

// 安全的 base64 编码（兼容 Workers，支持 Unicode）
function b64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function b64Decode(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function hex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function b64FromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// HMAC 签名
async function sign(data, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64Encode(data) + '.' + hex(sig);
}
async function verify(signed, secret) {
  const parts = signed.split('.');
  if (parts.length !== 2) return null;
  try {
    const data = b64Decode(parts[0]);
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expected = hex(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
    if (parts[1] !== expected) return null;
    return JSON.parse(data);
  } catch { return null; }
}

async function getUser(req, env) {
  const c = req.headers.get('Cookie');
  if (!c) return null;
  const m = c.match(/session=([^;]+)/);
  if (!m) return null;
  return verify(m[1], env.GOOGLE_CLIENT_SECRET);
}
async function getCredits(req, env) {
  const c = req.headers.get('Cookie');
  if (!c) return 3;
  const m = c.match(/credits=([^;]+)/);
  if (!m) return 3;
  const data = await verify(m[1], env.GOOGLE_CLIENT_SECRET);
  return data ? data.credits : 3;
}

function nav(user) {
  return `<nav class="navbar"><a href="/" class="logo">Remove BG</a><div class="nav-links"><a href="/" class="nav-link">Home</a><a href="/pricing" class="nav-link">Pricing</a><a href="/faq" class="nav-link">FAQ</a>` +
    (user ? `<a href="/dashboard" class="nav-link">Dashboard</a><a href="/auth/logout" class="btn-logout">Logout</a>` : `<a href="/auth/login" class="btn-google"><svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Login</a>`) +
    `</div></nav>`;
}

const CSS = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;color:#333}.navbar{max-width:1100px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;padding:15px 20px}.navbar .logo{color:#fff;font-size:1.3rem;font-weight:700;text-decoration:none}.nav-links{display:flex;align-items:center;gap:20px}.nav-link{color:rgba(255,255,255,.85);text-decoration:none;font-size:.95rem}.nav-link:hover{color:#fff}.btn-google{display:inline-flex;align-items:center;gap:8px;background:#fff;color:#333;padding:8px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:.9rem}.btn-logout{color:rgba(255,255,255,.8);text-decoration:none;font-size:.85rem;border:1px solid rgba(255,255,255,.3);padding:6px 16px;border-radius:6px}.btn-logout:hover{background:rgba(255,255,255,.15);color:#fff}.hero{text-align:center;color:#fff;padding:40px 20px 10px}.hero h1{font-size:2.5rem;text-shadow:0 2px 10px rgba(0,0,0,.2);margin-bottom:10px}.hero .subtitle{font-size:1.1rem;color:rgba(255,255,255,.85)}.hero .cta-hint{margin-top:10px;font-size:.95rem}.container{background:#fff;border-radius:20px;padding:30px;max-width:900px;width:100%;margin:20px auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}.upload-zone{border:3px dashed #ddd;border-radius:16px;padding:50px;text-align:center;cursor:pointer;transition:all .3s;background:#fafafa}.upload-zone:hover,.upload-zone.dragover{border-color:#667eea;background:#f0f0ff}.upload-zone .icon{font-size:4rem;margin-bottom:15px}.upload-zone p{color:#666;font-size:1.1rem}.upload-zone .hint{color:#999;font-size:.85rem;margin-top:8px}#fileInput{display:none}.preview-section{display:none;margin-top:25px}.preview-section.active{display:block}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.preview-card{border-radius:12px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,.1)}.preview-card .label{background:#f5f5f5;padding:10px 15px;font-weight:600;font-size:.9rem}.preview-card img{width:100%;height:300px;object-fit:contain;background:#f9f9f9;display:block}.result-img{background-image:linear-gradient(45deg,#e0e0e0 25%,transparent 25%),linear-gradient(-45deg,#e0e0e0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e0e0e0 75%),linear-gradient(-45deg,transparent 75%,#e0e0e0 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}.loading-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:100;justify-content:center;align-items:center}.loading-overlay.active{display:flex}.loading-box{background:#fff;padding:40px;border-radius:16px;text-align:center}.spinner{width:50px;height:50px;border:4px solid #f3f3f3;border-top:4px solid #667eea;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 15px}@keyframes spin{to{transform:rotate(360deg)}}.btn-group{display:flex;gap:12px;margin-top:20px;justify-content:center}.btn{padding:12px 28px;border:none;border-radius:10px;font-size:1rem;cursor:pointer;transition:all .3s;font-weight:600;text-decoration:none;display:inline-block;text-align:center}.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff}.btn-primary:hover{transform:translateY(-2px);box-shadow:0 5px 20px rgba(102,126,234,.4)}.btn-secondary{background:#f0f0f0;color:#333}.btn-secondary:hover{background:#e0e0e0}.btn-block{display:block;width:100%}.error-msg{display:none;background:#fff5f5;border:1px solid #feb2b2;color:#c53030;padding:15px 20px;border-radius:10px;margin-top:15px;text-align:center}.error-msg.active{display:block}.no-credits{text-align:center;padding:40px}.no-credits h3{margin-bottom:10px}.no-credits p{color:#666;margin-bottom:20px}.pricing-header{text-align:center;color:#fff;padding:40px 20px 20px}.pricing-header h1{font-size:2.2rem;text-shadow:0 2px 10px rgba(0,0,0,.2)}.pricing-header .subtitle{color:rgba(255,255,255,.8);margin-top:8px}.pricing-tabs{display:flex;justify-content:center;gap:10px;margin:20px 0}.tab{padding:10px 24px;border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;border-radius:10px;cursor:pointer;font-size:1rem;font-weight:600}.tab.active{background:#fff;color:#667eea;border-color:#fff}.pricing-container{max-width:1000px;margin:0 auto;padding:0 20px 30px}.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}.pricing-card{background:#fff;border-radius:16px;padding:30px;text-align:center;position:relative;box-shadow:0 10px 40px rgba(0,0,0,.15);transition:transform .3s}.pricing-card:hover{transform:translateY(-5px)}.pricing-card.featured{border:2px solid #667eea;transform:scale(1.05)}.pricing-card.featured:hover{transform:scale(1.05) translateY(-5px)}.badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:4px 16px;border-radius:20px;font-size:.8rem;font-weight:600;white-space:nowrap}.plan-name{font-size:1.2rem;font-weight:700;margin-bottom:10px}.plan-price{font-size:2.5rem;font-weight:800}.plan-price span{font-size:1rem;font-weight:400;color:#999}.plan-desc{color:#667eea;font-weight:600;margin:5px 0 20px}.plan-features{list-style:none;text-align:left;margin-bottom:25px}.plan-features li{padding:6px 0;color:#555;font-size:.95rem}.trust-bar{display:flex;justify-content:center;gap:30px;padding:20px;color:rgba(255,255,255,.8);font-size:.9rem;flex-wrap:wrap}.faq-section{max-width:700px;margin:20px auto 40px;padding:0 20px}.faq-section h2{color:#fff;text-align:center;margin-bottom:20px}.faq-list{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.15)}.faq-item{border-bottom:1px solid #f0f0f0;cursor:pointer}.faq-item:last-child{border-bottom:none}.faq-q{padding:18px 20px;font-weight:600;display:flex;justify-content:space-between;align-items:center}.faq-q .arrow{transition:transform .3s;color:#999}.faq-item.open .faq-q .arrow{transform:rotate(90deg)}.faq-a{padding:0 20px 18px;color:#666;line-height:1.6;display:none}.faq-item.open .faq-a{display:block}.dashboard{max-width:800px;margin:0 auto;padding:30px 20px 60px}.dashboard h1{color:#fff;font-size:1.8rem;margin-bottom:25px;text-shadow:0 2px 10px rgba(0,0,0,.2)}.card{background:#fff;border-radius:16px;padding:25px;margin-bottom:20px;box-shadow:0 10px 40px rgba(0,0,0,.15)}.card h2{font-size:1.1rem;margin-bottom:15px}.user-card{display:flex;align-items:center;gap:20px}.user-avatar img{width:64px;height:64px;border-radius:50%;border:3px solid #667eea22}.user-name{font-size:1.2rem;font-weight:700}.user-email{color:#888;font-size:.9rem;margin-top:2px}.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin-bottom:15px}.stat-item{text-align:center;padding:15px;background:#f8f9ff;border-radius:12px}.stat-value{font-size:2rem;font-weight:800;color:#667eea}.stat-label{font-size:.85rem;color:#888;margin-top:4px}@media(max-width:768px){.pricing-grid{grid-template-columns:1fr;max-width:400px;margin:0 auto}.pricing-card.featured{transform:none}.pricing-card.featured:hover{transform:translateY(-5px)}.preview-grid{grid-template-columns:1fr}.upload-zone{padding:30px}.hero h1{font-size:1.8rem}.stats-grid{grid-template-columns:1fr}.user-card{flex-direction:column;text-align:center}.trust-bar{flex-direction:column;align-items:center;gap:10px}}`;

// ==================== HTML 页面 ====================
function homePage(user, credits) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Remove BG - Remove Image Background Online</title><style>${CSS}</style></head><body>${nav(user)}<div class="hero"><h1>Remove Background</h1><p class="subtitle">Remove image backgrounds instantly with AI</p>${user ? `<p class="cta-hint">Credits: <strong>${credits}</strong></p>` : '<p class="cta-hint">Sign up and get <strong>3 free</strong> credits</p>'}</div><div class="container">${user && credits <= 0 ? `<div class="no-credits"><h3>No Credits</h3><p>Purchase a credit pack or subscription to continue</p><a href="/pricing" class="btn btn-primary">View Pricing</a></div>` : `<div class="upload-zone" id="uploadZone"><div class="icon">📷</div><p>Drop image here or click to upload</p><p class="hint">JPG / PNG / WebP</p><input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp"></div><div class="error-msg" id="errorMsg"></div><div class="preview-section" id="previewSection"><div class="preview-grid"><div class="preview-card"><div class="label">Original</div><img id="originalImg" src=""></div><div class="preview-card"><div class="label">Result</div><img id="resultImg" class="result-img" src=""></div></div><div class="btn-group"><button class="btn btn-primary" id="downloadBtn">Download</button><button class="btn btn-secondary" id="resetBtn">New Image</button></div></div>`}</div><div class="loading-overlay" id="loadingOverlay"><div class="loading-box"><div class="spinner"></div><p>Removing background...</p><p style="color:#999;font-size:.85rem;margin-top:8px">Usually takes 5-15 seconds</p></div></div>${user && credits > 0 ? `<script>var uz=document.getElementById('uploadZone'),fi=document.getElementById('fileInput'),ps=document.getElementById('previewSection'),oi=document.getElementById('originalImg'),ri=document.getElementById('resultImg'),db=document.getElementById('downloadBtn'),rb=document.getElementById('resetBtn'),lo=document.getElementById('loadingOverlay'),em=document.getElementById('errorMsg');uz.onclick=function(){fi.click()};uz.ondragover=function(e){e.preventDefault();uz.classList.add('dragover')};uz.ondragleave=function(){uz.classList.remove('dragover')};uz.ondrop=function(e){e.preventDefault();uz.classList.remove('dragover');if(e.dataTransfer.files.length>0)hf(e.dataTransfer.files[0])};fi.onchange=function(e){if(e.target.files.length>0)hf(e.target.files[0])};async function hf(f){if(!['image/jpeg','image/png','image/webp'].includes(f.type)){se('Please upload JPG/PNG/WebP');return}em.classList.remove('active');var r=new FileReader();r.onload=function(e){oi.src=e.target.result};r.readAsDataURL(f);lo.classList.add('active');try{var fd=new FormData();fd.append('image',f);var res=await fetch('/api/remove-bg',{method:'POST',body:fd});var d=await res.json();if(!res.ok){if(res.status===402){window.location.href='/pricing';return}throw new Error(d.error||'Failed')}ri.src=d.image;ps.classList.add('active');uz.style.display='none'}catch(err){se(err.message)}finally{lo.classList.remove('active')}}db.onclick=function(){var a=document.createElement('a');a.href=ri.src;a.download='no-bg-'+Date.now()+'.png';a.click()};rb.onclick=function(){ps.classList.remove('active');uz.style.display='';fi.value='';em.classList.remove('active');location.reload()};function se(m){em.textContent=m;em.classList.add('active')}</script>` : ''}</body></html>`;
}

function pricingPage(user, credits) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pricing - Remove BG</title><style>${CSS}</style></head><body>${nav(user)}<div class="pricing-header"><h1>Choose Your Plan</h1><p class="subtitle">Simple, transparent pricing</p>${user ? `<p class="cta-hint">Current credits: <strong>${credits}</strong></p>` : ''}</div><div class="pricing-tabs"><button class="tab active" onclick="st('s')">Monthly</button><button class="tab" onclick="st('c')">Credit Packs</button></div><div class="pricing-container"><div class="pricing-grid" id="st"><div class="pricing-card"><div class="plan-name">Basic</div><div class="plan-price">$0.99<span>/mo</span></div><div class="plan-desc">10 uses/month</div><ul class="plan-features"><li>10 credits/month</li><li>HD download</li><li>No watermark</li></ul>${user ? `<button class="btn btn-secondary btn-block" onclick="bp('sub-basic',0.99)">Subscribe</button>` : `<a href="/auth/login" class="btn btn-secondary btn-block">Login to Subscribe</a>`}</div><div class="pricing-card featured"><div class="badge">Popular</div><div class="plan-name">Standard</div><div class="plan-price">$1.99<span>/mo</span></div><div class="plan-desc">30 uses/month</div><ul class="plan-features"><li>30 credits/month</li><li>HD download</li><li>No watermark</li><li>Priority</li></ul>${user ? `<button class="btn btn-primary btn-block" onclick="bp('sub-standard',1.99)">Subscribe</button>` : `<a href="/auth/login" class="btn btn-primary btn-block">Login to Subscribe</a>`}</div><div class="pricing-card"><div class="plan-name">Premium</div><div class="plan-price">$3.99<span>/mo</span></div><div class="plan-desc">80 uses/month</div><ul class="plan-features"><li>80 credits/month</li><li>HD download</li><li>No watermark</li><li>Priority</li></ul>${user ? `<button class="btn btn-secondary btn-block" onclick="bp('sub-premium',3.99)">Subscribe</button>` : `<a href="/auth/login" class="btn btn-secondary btn-block">Login to Subscribe</a>`}</div></div><div class="pricing-grid" id="sc" style="display:none"><div class="pricing-card"><div class="plan-name">Basic Pack</div><div class="plan-price">$2.99</div><div class="plan-desc">100 credits</div><ul class="plan-features"><li>100 uses</li><li>Never expires</li><li>HD download</li></ul>${user ? `<button class="btn btn-secondary btn-block" onclick="bp('basic',2.99)">Buy</button>` : `<a href="/auth/login" class="btn btn-secondary btn-block">Login to Buy</a>`}</div><div class="pricing-card featured"><div class="badge">Popular</div><div class="plan-name">Standard Pack</div><div class="plan-price">$9.99</div><div class="plan-desc">500 credits</div><ul class="plan-features"><li>500 uses</li><li>Never expires</li><li>HD download</li><li>Save $5</li></ul>${user ? `<button class="btn btn-primary btn-block" onclick="bp('standard',9.99)">Buy</button>` : `<a href="/auth/login" class="btn btn-primary btn-block">Login to Buy</a>`}</div><div class="pricing-card"><div class="plan-name">Super Pack</div><div class="plan-price">$17.99</div><div class="plan-desc">1000 credits</div><ul class="plan-features"><li>1000 uses</li><li>Never expires</li><li>HD download</li><li>Save $12</li></ul>${user ? `<button class="btn btn-secondary btn-block" onclick="bp('super',17.99)">Buy</button>` : `<a href="/auth/login" class="btn btn-secondary btn-block">Login to Buy</a>`}</div></div></div><div class="trust-bar"><span>Secure Payment</span><span>Cancel Anytime</span><span>7-Day Refund</span><span>No Image Storage</span></div><div class="faq-section"><h2>FAQ</h2><div class="faq-list"><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">What's the difference between credit packs and subscriptions?<span class="arrow">▸</span></div><div class="faq-a">Credit packs are one-time purchases that never expire. Subscriptions auto-renew monthly.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">Do credits expire?<span class="arrow">▸</span></div><div class="faq-a">No. Credit pack credits never expire.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">How to cancel subscription?<span class="arrow">▸</span></div><div class="faq-a">Cancel anytime from your dashboard.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">Are my images saved?<span class="arrow">▸</span></div><div class="faq-a">No. All images are processed in memory and immediately destroyed.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">Can I get a refund?<span class="arrow">▸</span></div><div class="faq-a">Yes, 7-day money back guarantee.</div></div></div></div><script>function st(t){document.querySelectorAll('.tab').forEach(function(e){e.classList.remove('active')});if(t==='s'){document.getElementById('st').style.display='';document.getElementById('sc').style.display='none';document.querySelectorAll('.tab')[0].classList.add('active')}else{document.getElementById('st').style.display='none';document.getElementById('sc').style.display='';document.querySelectorAll('.tab')[1].classList.add('active')}}async function bp(id,price){var btn=event.target;btn.disabled=true;btn.textContent='Loading...';try{var res=await fetch('/api/paypal/create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({packId:id})});var d=await res.json();if(!res.ok)throw new Error(d.error);window.location.href=d.approvalUrl}catch(err){alert('Error: '+err.message);btn.disabled=false;btn.textContent='Buy'}}</script></body></html>`;
}

function dashboardPage(user, credits) {
  if (!user) return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/auth/login"></head><body></body></html>`;
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dashboard - Remove BG</title><style>${CSS}</style></head><body>${nav(user)}<div class="dashboard"><h1>Dashboard</h1><div class="card user-card"><div class="user-avatar"><img src="${user.picture || ''}" onerror="this.style.display='none'"></div><div class="user-info"><div class="user-name">${user.name || 'User'}</div><div class="user-email">${user.email}</div></div></div><div class="card"><h2>Credits</h2><div class="stats-grid"><div class="stat-item"><div class="stat-value">${credits}</div><div class="stat-label">Remaining</div></div></div></div><div class="card"><h2>Get More</h2><p style="color:#666;margin-bottom:15px">Purchase credit packs or subscribe</p><a href="/pricing" class="btn btn-primary">View Pricing</a></div></div></body></html>`;
}

function faqPage(user) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FAQ - Remove BG</title><style>${CSS}</style></head><body>${nav(user)}<div class="pricing-header"><h1>FAQ</h1></div><div class="container" style="max-width:700px"><div class="faq-list"><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">What is this tool?<span class="arrow">▸</span></div><div class="faq-a">AI-powered background removal tool. Upload an image, get a transparent PNG.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">What formats are supported?<span class="arrow">▸</span></div><div class="faq-a">JPG, PNG, WebP.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">What's the free limit?<span class="arrow">▸</span></div><div class="faq-a">3 free credits on signup. After that, purchase credits.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">Are images saved?<span class="arrow">▸</span></div><div class="faq-a">No. Processed in memory and immediately destroyed.</div></div><div class="faq-item" onclick="this.classList.toggle('open')"><div class="faq-q">How long does it take?<span class="arrow">▸</span></div><div class="faq-a">Usually 5-15 seconds.</div></div></div></div></body></html>`;
}

function successPage(user, credits, name) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Success</title><style>${CSS}</style></head><body>${nav(user)}<div class="container" style="max-width:500px;text-align:center;margin-top:60px"><div style="font-size:4rem;margin-bottom:20px">🎉</div><h2>Payment Successful!</h2><p style="color:#666;margin:10px 0">${name}</p><p style="color:#667eea;font-size:1.5rem;font-weight:700;margin:15px 0">Balance: ${credits} credits</p><a href="/" class="btn btn-primary" style="margin-right:10px">Start Using</a><a href="/dashboard" class="btn btn-secondary">Dashboard</a></div></body></html>`;
}

function cancelPage(user) {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Cancelled</title><style>${CSS}</style></head><body>${nav(user)}<div class="container" style="max-width:500px;text-align:center;margin-top:60px"><div style="font-size:4rem;margin-bottom:20px">😔</div><h2>Payment Cancelled</h2><p style="color:#666;margin:20px 0">No payment was made</p><a href="/pricing" class="btn btn-primary" style="margin-right:10px">Back to Pricing</a><a href="/" class="btn btn-secondary">Home</a></div></body></html>`;
}

// ==================== Worker 主入口 ====================
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/auth/login') return handleLogin(request, env);
      if (url.pathname === '/auth/callback') return handleCallback(request, env);
      if (url.pathname === '/auth/logout') return handleLogout();
      if (url.pathname === '/api/paypal/create-order' && request.method === 'POST') return handleCreateOrder(request, env);
      if (url.pathname === '/paypal/success') return handlePaypalSuccess(request, env);
      if (url.pathname === '/paypal/cancel') {
        const user = await getUser(request, env);
        return html(cancelPage(user));
      }
      if (url.pathname === '/api/me') {
        const user = await getUser(request, env);
        const credits = await getCredits(request, env);
        return Response.json(user ? { ...user, credits } : { logged_in: false });
      }
      if (url.pathname === '/api/remove-bg' && request.method === 'POST') return handleRemoveBg(request, env);
      if (url.pathname === '/api/health') return Response.json({ status: 'ok' });

      const user = await getUser(request, env);
      const credits = await getCredits(request, env);
      let page;
      switch (url.pathname) {
        case '/pricing': page = pricingPage(user, credits); break;
        case '/dashboard': page = dashboardPage(user, credits); break;
        case '/faq': page = faqPage(user); break;
        default: page = homePage(user, credits); break;
      }
      return html(page);
    } catch (e) {
      return new Response('Error: ' + e.message + '\n' + e.stack, { status: 500 });
    }
  },
};

function html(content) {
  return new Response(content, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ==================== PayPal ====================
async function getPaypalToken(env) {
  const auth = btoa(env.PAYPAL_CLIENT_ID + ':' + env.PAYPAL_CLIENT_SECRET);
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('PayPal auth failed');
  return data.access_token;
}

async function handleCreateOrder(request, env) {
  const user = await getUser(request, env);
  if (!user) return Response.json({ error: 'Login required' }, { status: 401 });

  const { packId } = await request.json();
  let pack = CREDIT_PACKS[packId];
  if (!pack) pack = SUBSCRIPTION_PLANS[packId.replace('sub-', '')];
  if (!pack) return Response.json({ error: 'Invalid pack' }, { status: 400 });

  const token = await getPaypalToken(env);
  const origin = new URL(request.url).origin;

  const res = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ description: pack.name, amount: { currency_code: 'USD', value: pack.price.toString() }, custom_id: packId }],
      application_context: { return_url: origin + '/paypal/success?packId=' + packId, cancel_url: origin + '/paypal/cancel', user_action: 'PAY_NOW', brand_name: 'Remove BG' },
    }),
  });

  const order = await res.json();
  if (!order.id) return Response.json({ error: 'Order failed' }, { status: 500 });

  const link = order.links.find(l => l.rel === 'approve');
  if (!link) return Response.json({ error: 'No approval link' }, { status: 500 });

  return Response.json({ orderId: order.id, approvalUrl: link.href });
}

async function handlePaypalSuccess(request, env) {
  const url = new URL(request.url);
  const packId = url.searchParams.get('packId');
  const token = url.searchParams.get('token');

  const user = await getUser(request, env);
  if (!user) return Response.redirect('/auth/login', 302);

  try {
    const paypalToken = await getPaypalToken(env);
    const capRes = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders/' + token + '/capture', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + paypalToken, 'Content-Type': 'application/json' },
    });
    const capture = await capRes.json();

    if (capture.status === 'COMPLETED') {
      let pack = CREDIT_PACKS[packId];
      if (!pack) pack = SUBSCRIPTION_PLANS[packId.replace('sub-', '')];
      const current = await getCredits(request, env);
      const newCredits = current + (pack ? pack.credits : 0);
      const creditsCookie = await sign(JSON.stringify({ credits: newCredits }), env.GOOGLE_CLIENT_SECRET);

      return new Response(successPage(user, newCredits, pack ? pack.name : ''), {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': 'credits=' + creditsCookie + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (365 * 24 * 3600),
        },
      });
    }
  } catch (e) {
    console.error('PayPal capture error:', e);
  }
  return html(cancelPage(user));
}

// ==================== OAuth ====================
function handleLogin(request, env) {
  const url = new URL(request.url);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: url.origin + '/auth/callback',
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  return Response.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params, 302);
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return new Response('Auth failed', { status: 400 });

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: url.origin + '/auth/callback', grant_type: 'authorization_code' }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) return new Response('Auth failed', { status: 400 });

  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + tokenData.access_token } });
  const userInfo = await userRes.json();
  if (!userInfo.email) return new Response('Auth failed', { status: 400 });

  const sessionCookie = await sign(JSON.stringify({ email: userInfo.email, name: userInfo.name, picture: userInfo.picture }), env.GOOGLE_CLIENT_SECRET);
  return new Response(null, {
    status: 302,
    headers: { Location: '/dashboard', 'Set-Cookie': 'session=' + sessionCookie + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + (7 * 24 * 3600) },
  });
}

function handleLogout() {
  return new Response(null, { status: 302, headers: { Location: '/', 'Set-Cookie': 'session=; Path=/; Max-Age=0' } });
}

// ==================== Remove BG ====================
async function handleRemoveBg(request, env) {
  const formData = await request.formData();
  const file = formData.get('image');
  if (!file) return Response.json({ error: 'No image' }, { status: 400 });

  const buf = await file.arrayBuffer();
  const fd = new FormData();
  fd.append('image_file', new Blob([buf], { type: file.type }), file.name);
  fd.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', { method: 'POST', headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY }, body: fd });
  if (!res.ok) return Response.json({ error: 'API error: ' + res.status }, { status: res.status });

  const result = await res.arrayBuffer();
  const bytes = new Uint8Array(result);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return Response.json({ success: true, image: 'data:image/png;base64,' + btoa(binary) });
}
