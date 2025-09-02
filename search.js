// search.js — AI 자동완성 드롭다운 (서버 핑 불필요)

// ===== 0) 경로 헬퍼 (네 코드 유지/개선) =====
function getProjectRootPath() {
  const p = location.pathname;
  const m = p.match(/^(.*?)(?:\/(?:store|sale)(?:\/|$).*)/);
  if (m) return m[1].endsWith('/') ? m[1] : m[1] + '/';
  return p.endsWith('/') ? p : p.replace(/\/[^/]*$/, '/');
}
function toRealUrl(rootRelativePath) {
  const root = getProjectRootPath();
  const clean = (rootRelativePath || '').replace(/^\/+/, '');
  return (root + clean).replace(/\/{2,}/g, '/');
}

const fmtKRW = (n) => new Intl.NumberFormat('ko-KR').format(Number(n||0)) + '원';

function h(tag, props={}, ...children){
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k,v])=>{
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });
  children.flat().forEach(ch => el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch));
  return el;
}

function debounce(fn, ms=150){
  let t; return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
}

document.addEventListener('DOMContentLoaded', () => {
  // ===== 1) 검색 폼 요소 찾기 =====
  const searchForms = document.querySelectorAll('form.search-bar');
  if (!searchForms.length) return;

  // 폼마다 자동완성 박스 붙이기
  searchForms.forEach((form) => {
    const input  = form.querySelector('input[name="q"]') || form.querySelector('input');
    const button = form.querySelector('.search-btn');
    if (!input) return;

    // 제안 상자 생성 (스타일은 Mainstyle.css를 최대한 따르고, 최소한의 인라인만)
    const box = h('div', {
      id: 'aiSuggestBox',
      class: 'ai-suggest',
      style: {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: '0',
        right: '0',
        border: '1px solid #ddd',
        borderRadius: '10px',
        background: '#fff',
        boxShadow: '0 8px 24px rgba(0,0,0,.08)',
        overflow: 'hidden',
        display: 'none',
        maxHeight: '420px',
        overflowY: 'auto',
        zIndex: '9999',
      }
    });

    // 포지셔닝 컨테이너
    const wrap = h('div', { style: { position: 'relative' }});
    form.parentNode.insertBefore(wrap, form);
    wrap.appendChild(form);
    wrap.appendChild(box);

    let items = [];
    let activeIdx = -1;

    function hideBox(){ box.style.display = 'none'; activeIdx = -1; }
    function showBox(){ if (items.length) box.style.display = 'block'; }

    function render(itemsList, queryText){
      items = itemsList || [];
      activeIdx = -1;
      box.innerHTML = '';

      if (!items.length) { hideBox(); return; }

      items.forEach((it, i) => {
        const row = h('div', {
          class: 's-item',
          style: {
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            padding: '10px 12px',
            cursor: 'pointer'
          },
          onmouseenter: ()=>{ activeIdx = i; highlight(); },
          onclick: ()=> goDetail(it.id),
          role: 'option',
          'aria-selected': 'false'
        },
          h('img', { class: 's-thumb', src: it.image || '', alt:'', style: {
            width:'40px',height:'40px',borderRadius:'8px',objectFit:'cover',background:'#f2f2f2'
          }}),
          h('div', { class: 's-main' },
            h('div', { class: 's-name', style:{fontSize:'14px',fontWeight:'600'} }, it.name),
            h('div', { class: 's-price', style:{fontSize:'12px',color:'#666'} }, fmtKRW(it.price))
          )
        );
        box.appendChild(row);
      });

      // 마지막에 “검색어로 전체 보기” 링크
      const all = h('div', { class:'s-item', style:{padding:'10px 12px', borderTop:'1px solid #f1f1f1', cursor:'pointer'},
        onclick: ()=> location.href = toRealUrl(`store.html?q=${encodeURIComponent(queryText||'')}`) },
        h('div', { class:'s-main' },
          h('div', { class:'s-name', style:{fontSize:'13px'} }, `‘${queryText}’ 전체보기`)
        )
      );
      box.appendChild(all);

      showBox();
      highlight();
    }

    function highlight(){
      [...box.children].forEach((el, idx)=>{
        if (idx === activeIdx) {
          el.style.background = '#f6fffe';
        } else {
          el.style.background = '#fff';
        }
      });
    }

    function goDetail(id){
      if (!id) return;
      // 네 사이트의 상세 URL 규칙: store/product.html?id=ID
      location.href = toRealUrl(`store/product.html?id=${encodeURIComponent(id)}`);
    }

    async function fetchSuggest(q){
      const url = toRealUrl(`api/ai/suggest?q=${encodeURIComponent(q)}`);
      const res = await fetch(url, { credentials:'include' }).catch(()=>null);
      if (!res || !res.ok) return [];
      const data = await res.json().catch(()=>({}));
      if (data && data.ok && Array.isArray(data.items)) return data.items;
      return [];
    }

    const onInput = debounce(async () => {
      const q = (input.value || '').trim();
      if (!q) { hideBox(); return; }
      try {
        const list = await fetchSuggest(q);
        render(list, q);
      } catch {
        hideBox();
      }
    }, 120);

    input.addEventListener('input', onInput);
    input.addEventListener('focus', onInput);

    // 키보드 내비게이션
    input.addEventListener('keydown', (e) => {
      if (box.style.display === 'none') return;
      const count = box.children.length; // + “전체보기” 포함
      if (!count) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, count - 2); // 마지막은 전체보기이니 -2까지 상품
        highlight();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        highlight();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < items.length) {
          goDetail(items[activeIdx].id);
        } else {
          // 선택 없으면 전체 보기
          const q = (input.value || '').trim();
          location.href = toRealUrl(`store.html?q=${encodeURIComponent(q)}`);
        }
      } else if (e.key === 'Escape') {
        hideBox();
      }
    });

    // 포커스 밖 클릭 시 닫기
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) hideBox();
    });

    // 폼 submit(버튼 클릭 포함): 기본은 전체 보기로 이동
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = (input.value || '').trim();
      if (!q) return;
      location.href = toRealUrl(`store.html?q=${encodeURIComponent(q)}`);
    });
    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const q = (input.value || '').trim();
        if (!q) return;
        location.href = toRealUrl(`store.html?q=${encodeURIComponent(q)}`);
      });
    }
  });
});

