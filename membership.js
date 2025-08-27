/* Membership page — strong guarantee: at least 1 coupon shown */
"use strict";

/* ---- 티어 ---- */
const TIERS = [
  { level: "LV100", min: 1_000_000 },
  { level: "LV10",  min:   100_000 },
  { level: "LV1",   min:         0 },
];
const decideLevel = (n) => TIERS.find(t => n >= t.min).level;
function nextTier(n){
  const h = TIERS.filter(t => n < t.min).sort((a,b)=>a.min-b.min)[0];
  return h ? { nextLevel:h.level, remain:h.min-n, nextMin:h.min } : { nextLevel:null, remain:0, nextMin:null };
}

/* ---- 테마/히어로 ---- */
function themeFromGender(g){ return String(g).toLowerCase()==='female' ? 'Maltiz' : 'Retriever'; }
const HERO_MAP = {
  Retriever: {
    LV1:"https://i.pinimg.com/1200x/f6/24/9e/f6249e48013bb7ae2c2fd2e8762dc82c.jpg",
    LV10:"https://i.pinimg.com/1200x/0d/5f/c3/0d5fc34bf0384818ebc0ddac2ee0d1ee.jpg",
    LV100:"https://i.pinimg.com/1200x/1c/3a/38/1c3a3859dab32019c0ca7c8cd9edf620.jpg",
  },
  Maltiz: {
    LV1:"https://i.pinimg.com/1200x/98/e9/63/98e9635353c49cce889b36c734962859.jpg",
    LV10:"https://i.pinimg.com/1200x/4b/40/d6/4b40d69fa7bd91fee9a2aa954965fcfc.jpg",
    LV100:"https://i.pinimg.com/1200x/c9/a2/8e/c9a28eb2973183caa9fdf5e474a38c55.jpg",
  },
};

/* ---- 쿠폰 공통 ---- */
async function fetchMyCoupons(){
  const r = await fetch('/api/coupons/me', { credentials:'include' });
  if (!r.ok) return [];
  const d = await r.json().catch(()=>({}));
  return Array.isArray(d.coupons) ? d.coupons : [];
}
const isAvail = (c)=> !c.used_order_id && (!c.expires_at || new Date(c.expires_at) > new Date());
const codePriority = (code='') => code.startsWith('M_LV100') ? 3 : code.startsWith('M_LV10') ? 2 : 1;

async function ensureCouponsAccordingToLifetime(lifetime){
  let cs = await fetchMyCoupons();

  const needLv10  = lifetime >= 100_000  && !cs.some(c => isAvail(c) && String(c.code).startsWith('M_LV10'));
  const needLv100 = lifetime >= 1_000_000 && !cs.some(c => isAvail(c) && String(c.code).startsWith('M_LV100'));
  if (needLv10 || needLv100) {
    await fetch('/api/membership/claim', { method:'POST', credentials:'include' }).catch(()=>{});
    cs = await fetchMyCoupons();
  }

  if (!cs.some(isAvail)) {
    await fetch('/api/membership/claim', { method:'POST', credentials:'include' }).catch(()=>{});
    cs = await fetchMyCoupons();
  }
  return cs;
}

function renderOneAvailableCoupon(cs){
  const box = document.getElementById('couponList');
  if (!box) return;
  const avail = cs.filter(isAvail).sort((a,b)=> codePriority(b.code) - codePriority(a.code));
  const c = avail[0];
  if (!c){ box.innerHTML = `<div class="coupon-item">No coupons yet.</div>`; return; }
  const benefit = c.kind==='shipping' ? 'Free Shipping' : `${Number(c.amount).toLocaleString()}₩ Discount`;
  const expTxt  = c.expires_at ? ` (exp. ${new Date(c.expires_at).toLocaleDateString()})` : '';
  box.innerHTML = `
    <div class="coupon-item">
      <img src="https://ninjastorage.blob.core.windows.net/companyfiles/205623498/e13f727c-1a10-4a10-a878-3dba92afb77f.png" alt="Coupon">
      <div>
        <div><strong>${c.label || c.code}</strong>${expTxt}</div>
        <div>${benefit}</div>
      </div>
      <span class="badge">AVAILABLE</span>
    </div>`;
}

/* ---- lifetime 재계산 ---- */
async function recomputeLifetimeFromAPI(){
  try{
    const r = await fetch('/api/orders/me', { credentials:'include' });
    if (!r.ok) return null;
    const p = await r.json();
    if (typeof p.lifetime === 'number' && p.level) {
      localStorage.setItem('lifetimeSpendKRW', String(p.lifetime));
      localStorage.setItem('membershipLevel', p.level);
      return { lifetime:p.lifetime, level:p.level };
    }
    const orders = Array.isArray(p?.orders) ? p.orders : [];
    const ELIGIBLE = new Set(['CREATED','PAID','FULFILLED']);
    const life = orders
      .filter(o => ELIGIBLE.has(String(o?.status||'').toUpperCase()))
      .reduce((s,o)=> s + Number(o?.total_price||0), 0);
    const level = decideLevel(life);
    localStorage.setItem('lifetimeSpendKRW', String(life));
    localStorage.setItem('membershipLevel', level);
    return { lifetime:life, level };
  } catch { return null; }
}

/* ---- UI ---- */
function renderMembershipUI({ lifetime, level, name, theme }){
  document.getElementById('ms-level')?.replaceChildren(level);
  document.getElementById('ms-sum')?.replaceChildren(`Total ${Number(lifetime).toLocaleString()}₩`);
  const info = nextTier(lifetime);
  const elNext = document.getElementById('ms-next');
  const elBar  = document.getElementById('ms-bar');
  if (elNext && elBar) {
    if (info.nextLevel) {
      elNext.textContent = `Only ${info.remain.toLocaleString()}₩ left to reach ${info.nextLevel}`;
      const curMin = TIERS.find(t => t.level === level)?.min ?? 0;
      const denom  = Math.max(1, (info.nextMin ?? curMin) - curMin);
      elBar.style.width = Math.min(100, ((lifetime - curMin)/denom)*100) + '%';
    } else {
      elNext.textContent = 'You have reached the highest tier!';
      elBar.style.width = '100%';
    }
  }
  document.getElementById('mi-name')?.replaceChildren(name || 'Guest');
  document.getElementById('mi-level-text')?.replaceChildren(`${level} ${theme}`);
  const hero = document.getElementById('memberHeroImg');
  if (hero) {
    const src = HERO_MAP?.[theme]?.[level] || HERO_MAP.Retriever.LV1;
    hero.src = src; hero.alt = `${level} ${theme}`;
    hero.classList.add('zoomable');
  }
}

/* ---- 초기화 ---- */
document.addEventListener('DOMContentLoaded', async () => {
  // 사용자 정보
  let name='Guest', theme=null;
  try{
    const r = await fetch('/api/auth/me', { credentials:'include' });
    if (r.ok) {
      const me = (await r.json()).user || {};
      name = me.name || name;
      theme = themeFromGender(me.gender);
    }
  }catch{}
  if (!theme) theme = localStorage.getItem('memberTheme') || 'Retriever';
  localStorage.setItem('userName', name);
  localStorage.setItem('memberTheme', theme);

  // 누적/레벨
  const latest = await recomputeLifetimeFromAPI();
  const lifetime = latest?.lifetime ?? Number(localStorage.getItem('lifetimeSpendKRW') || '0');
  const level    = latest?.level    ?? (localStorage.getItem('membershipLevel') || decideLevel(lifetime));

  // 쿠폰 보장 + 표시
  const coupons = await ensureCouponsAccordingToLifetime(lifetime);
  renderOneAvailableCoupon(coupons);

  renderMembershipUI({ lifetime, level, name, theme });
});

/* 이미지 확대 */
document.addEventListener('click', (e)=>{
  const img = e.target.closest('img.zoomable');
  if (!img) return;
  const ov = document.createElement('div'); ov.className='image-overlay';
  const large = document.createElement('img'); large.src = img.src;
  ov.appendChild(large);
  ov.addEventListener('click', ()=> ov.remove());
  document.addEventListener('keydown', function esc(ev){ if (ev.key==='Escape') ov.remove(); }, { once:true });
  document.body.appendChild(ov);
});