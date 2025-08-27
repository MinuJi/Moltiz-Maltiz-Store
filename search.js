// search.js (폴더 나눔 대응: 루트 기준으로 보관 -> 현재 위치에 맞춰 변환)
document.addEventListener('DOMContentLoaded', () => {
  // =============================
  // 0) 경로 헬퍼
  // =============================

  // 프로젝트 루트 경로 계산:
  //   /repo-name/store/xxx  -> /repo-name/
  //   /repo-name/sale/xxx   -> /repo-name/
  //   /repo-name/           -> /repo-name/
  //   /Home.html            -> /
  function getProjectRootPath() {
    const p = location.pathname;

    // /.../(store|sale)(/|$) 이전까지 자름
    const m = p.match(/^(.*?)(?:\/(?:store|sale)(?:\/|$).*)/);
    if (m) {
      return m[1].endsWith('/') ? m[1] : m[1] + '/';
    }

    // 이미 루트(= store/sale 밖). 파일이면 디렉토리로, 디렉토리면 그대로
    return p.endsWith('/') ? p : p.replace(/\/[^/]*$/, '/');
  }

  // 루트 기준 경로(root-relative, e.g. "store/Blanket.html")를
  // 현재 페이지에서 접근 가능한 실제 경로로 변환
  function toRealUrl(rootRelativePath) {
    const root = getProjectRootPath();
    const clean = (rootRelativePath || '').replace(/^\/+/, ''); // 앞의 / 제거
    return (root + clean).replace(/\/{2,}/g, '/');
  }

  // 문자열 정규화
  const norm = s => (s || '').toString().trim().toLowerCase();

  // 별칭 찾기 (부분 일치 허용)
  function findByAliases(aliases, q) {
    if (!q) return null;
    const nq = norm(q);
    for (const item of aliases) {
      for (const a of item.names) {
        const na = norm(a);
        if (!na) continue;
        if (na.includes(nq) || nq.includes(na)) return item.url; // url은 "루트 기준"으로
      }
    }
    return null;
  }

  // =============================
  // 1) 카테고리/메뉴 매핑 (루트 기준)
  // =============================
  const CATEGORY_ALIASES = [
    { url: 'Home.html',     names: ['home','홈','메인'] },
    { url: 'store.html',    names: ['all category','all','전체','카테고리','상품','스토어','store','shop','상점'] },
    { url: 'sale.html',     names: ['sale','세일','할인'] },
    { url: 'best.html',     names: ['best','베스트','인기'] },
    { url: 'event.html',    names: ['event','이벤트'] },
    { url: 'Gallery.html',  names: ['gallery','갤러리'] },
    { url: 'Minigame.html', names: ['mini game','minigame','게임'] },
    { url: 'service.html',  names: ['고객센터','cs','문의','service','customer service'] },
    // What/what 둘 중 하나만 존재해도 동작하도록 별칭만 둠
    { url: 'What.html',     names: ['what','what is moltiz','소개','몰티즈','moltiz','about'] },
  ];

  // =============================
  // 2) 상품 페이지 매핑 (루트 기준)
  //    - store/ 와 sale/ 아래 실제 파일명 기준
  // =============================
  const PRODUCT_ALIASES = [
    // 담요
    { url: 'store/Blanket.html',        names: ['blanket','담요','moltiz blanket','이불'] },

    // 가방
    { url: 'store/MolBag.html',         names: ['bag','가방','토트','몰티즈 가방','moltiz bag'] },

    // 키링 (Mol / Mal 둘 다)
    { url: 'store/MolKey.html',         names: ['keyring','키링','몰티즈 키링','moltiz keyring','key ring','mol key'] },
    { url: 'store/MalKey.html',         names: ['maltiz keyring','말티즈 키링','maltiz key ring','mal key'] },

    // 메모
    { url: 'store/MolMemo.html',        names: ['memo','메모','포스트잇','post-it','moltiz memo'] },

    // 마우스패드
    { url: 'store/MousePad.html',       names: ['mousepad','마우스패드','mouse pad','moltiz mousepad'] },

    // 러기지(네임택)
    { url: 'store/LogisticMol.html',    names: ['logistic','러기지','네임택','몰티즈 러기지','moltiz logistic','tag','mol logistic'] },
    { url: 'store/LogisticMal.html',    names: ['maltiz logistic','말티즈 러기지','name tag','mal logistic'] },

    // 랜덤 피규어
    { url: 'store/FigureFirst.html',    names: ['random figure1','figure1','랜덤 피규어1','랜덤피규어1'] },
    { url: 'store/FigureSecond.html',   names: ['random figure2','figure2','랜덤 피규어2','랜덤피규어2'] },

    // ===== 세일 전용 페이지(파일명 기준) =====
    { url: 'sale/BagMolSale.html',      names: ['sale bag','세일 가방','할인가 가방'] },
    { url: 'sale/BlanketBSale.html',    names: ['sale blanket','세일 담요','할인가 담요'] },
    { url: 'sale/LogiticMalSale.html',  names: ['sale logistic mal','세일 러기지 말','네임택 세일 mal'] },
    { url: 'sale/LogiticMolSale.html',  names: ['sale logistic mol','세일 러기지 몰','네임택 세일 mol'] },
  ];

  // 상세(서버 상품) 페이지가 있다면 사용 (루트 기준)
  const PRODUCT_DETAIL_URL = 'product.html?id=%ID%';

  // 폴백 목록 (루트 기준)
  const FALLBACK_LIST_URL = 'store.html';

  // =============================
  // 3) 라우팅
  // =============================
  async function routeSearch(query) {
    const q = (query || '').trim();
    if (!q) return alert('Please enter a search term.');

    // (1) 카테고리 우선
    const catUrl = findByAliases(CATEGORY_ALIASES, q);
    if (catUrl) {
      location.href = toRealUrl(catUrl);
      return;
    }

    // (2) 정적 상품 페이지
    const productUrl = findByAliases(PRODUCT_ALIASES, q);
    if (productUrl) {
      location.href = toRealUrl(productUrl);
      return;
    }

    // (3) 서버 검색 → 1개면 상세로
    try {
      const res = await fetch(`${toRealUrl('api/products')}?q=${encodeURIComponent(q)}&limit=5`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (data?.ok && Array.isArray(data.products) && data.products.length === 1) {
        const id = data.products[0]?.id;
        if (id && PRODUCT_DETAIL_URL.includes('%ID%')) {
          location.href = toRealUrl(PRODUCT_DETAIL_URL.replace('%ID%', encodeURIComponent(id)));
          return;
        }
      }
    } catch (_) {
      // 서버 검색 실패 시 폴백으로
    }

    // (4) 폴백: 목록 + 쿼리
    const fallback = `${FALLBACK_LIST_URL}?q=${encodeURIComponent(q)}`;
    location.href = toRealUrl(fallback);
  }

  // =============================
  // 4) 폼 바인딩
  // =============================
  document.querySelectorAll('form.search-bar').forEach(form => {
    const input  = form.querySelector('input[name="q"]');
    const button = form.querySelector('.search-btn');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      routeSearch(input?.value || '');
    });

    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        routeSearch(input?.value || '');
      });
    }
  });
});

