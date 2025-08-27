/*!
 * BookMark.js (fast)
 * - Heart toggle (♡/♥)
 * - localStorage with memoized cache
 * - Bookmark page render/remove
 * - Lightweight toast ("BookMark에 저장해놀게요" / "BookMark에서 삭제했어요")
 */
(function () {
  'use strict';

  // ====== 중복 초기화 방지 ======
  if (window.__MOLTIZ_BOOKMARK_INIT__) return;
  window.__MOLTIZ_BOOKMARK_INIT__ = true;

  /* ==============================
   * Storage (메모이즈 캐시)
   * ============================== */
  const LS_KEY = 'moltiz:bookmarks';
  /** 로컬 메모리 캐시 */
  let _cache = null;

  function _readLS() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  }
  function _writeLS(list) {
    localStorage.setItem(LS_KEY, JSON.stringify(list));
  }
  function _ensureCache() {
    if (!_cache) _cache = _readLS();
    return _cache;
  }
  function _invalidate() { _cache = null; }

  function load() {
    return _ensureCache().slice(); // 방어적 복사
  }
  function save(list) {
    _cache = list.slice();
    _writeLS(_cache);
  }
  function exists(id) {
    return _ensureCache().some(x => x.id === id);
  }
  function add(item) {
    const list = _ensureCache();
    if (!list.some(x => x.id === item.id)) {
      list.push({ ...item, addedAt: Date.now() });
      save(list);
    }
  }
  function remove(id) {
    const list = _ensureCache().filter(x => x.id !== id);
    save(list);
  }
  function clearAll() {
    save([]);
  }
  function toggle(item) {
    if (exists(item.id)) remove(item.id);
    else add(item);
  }

  // 다른 탭/창에서 변화가 생기면 캐시 무효화
  window.addEventListener('storage', (e) => {
    if (e.key === LS_KEY) _invalidate();
  });

  /* ==============================
   * Toast (경량)
   * ============================== */
  let toastTimer = null;
  function ensureToastEl() {
    let toast = document.querySelector('.bookmark-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'bookmark-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.style.zIndex = '2147483647';
      document.body.appendChild(toast);
    }
    return toast;
  }
  function showToast(message) {
    const toast = ensureToastEl();
    toast.textContent = message;
    toast.classList.remove('show');
    // 강제 리플로우로 transition 재적용
    // eslint-disable-next-line no-unused-expressions
    toast.offsetHeight;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      toastTimer = null;
    }, 1800);
  }

  /* ==============================
   * Hearts UI
   * ============================== */
  function setHeartUI(btn, liked) {
    // 최소한의 DOM 변경만
    if (!!btn._liked === !!liked) return; // 동일 상태면 건너뛰기
    btn._liked = liked;
    btn.classList.toggle('liked', liked);
    btn.textContent = liked ? '♥' : '♡';
    btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
    btn.type = 'button';
  }

  function getItemFromBtn(btn) {
    return {
      id:    btn.dataset.id,
      name:  btn.dataset.name || '',
      price: Number(btn.dataset.price || 0),
      image: btn.dataset.image || '',
      url:   btn.dataset.url   || '#'
    };
  }

  // 초기 하트 상태는 필요한 경우에만 부분 동기화
  function syncHeartsIn(container = document) {
    container.querySelectorAll('.heart-btn').forEach(btn => {
      const liked = exists(btn.dataset.id);
      setHeartUI(btn, liked);
    });
  }

  /* ==============================
   * Init (이벤트 위임만 사용)
   * ============================== */
  function init() {
    // 페이지 로드 시 1회만 초기 상태 반영 (전역 스캔 최소화)
    syncHeartsIn(document);

    // 클릭 위임 (capture 사용하지만 작업은 아주 가벼움)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.heart-btn');
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      if (btn.stopImmediatePropagation) e.stopImmediatePropagation();

      const item = getItemFromBtn(btn);
      if (!item.id) return;

      const was = exists(item.id);
      toggle(item);
      const liked = !was;
      setHeartUI(btn, liked);

      showToast(liked ? 'Saved to BookMark!' : 'Removed from BookMark.');
    }, true);
  }

  /* ==============================
   * Bookmark.html 렌더러
   * ============================== */
  function escapeHtml(s = '') {
    return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function renderBookmarkList(containerSelector = '#bookmarkList') {
    const el = document.querySelector(containerSelector);
    if (!el) return;

    const list = load().sort((a,b) => b.addedAt - a.addedAt);

    if (!list.length) {
      el.innerHTML = `
        <div class="empty">
          <p>No bookmarked items yet.</p>
          <a class="btn" href="/store.html">Go Store</a>
        </div>`;
      return;
    }

    // 문자열 한번에 빌드 (DOM 삽입 1회)
    let html = '';
    for (const x of list) {
      const url = (x.url || '#').replace(/'/g, '&#39;');
      html += `
        <div class="product-card">
          <div class="product-button" onclick="location.href='${url}'">
            <img src="${escapeHtml(x.image || '')}" alt="${escapeHtml(x.name || '')}">
            <h3>${escapeHtml(x.name || '')}</h3>
            <p>$${Number.isFinite(x.price) ? x.price : 0}</p>
          </div>
          <button class="remove-bookmark btn-outline" data-remove-id="${escapeHtml(x.id)}">Remove</button>
        </div>`;
    }
    el.innerHTML = html;

    // 개별 삭제 (위임 대신 범위 좁혀 직접 바인딩: 개수 적으니 빠름)
    el.querySelectorAll('[data-remove-id]').forEach(b => {
      b.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        remove(b.dataset.removeId);
        renderBookmarkList(containerSelector);
        // 다른 페이지의 하트 상태도 맞추고 싶다면 아래 호출 유지
        syncHeartsIn(document);
        showToast('Item removed from BookMark.');
      }, { once: true }); // 다시 렌더되면 새로 바인딩됨
    });
  }

  /* ==============================
   * 공개 API
   * ============================== */
  window.Favorites = {
    load, save, exists, add, remove, toggle,
    renderBookmarkList, clearAll,
    // 선택 컨테이너만 동기화할 때 사용 가능
    syncHeartsIn
  };

  // 자동 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();