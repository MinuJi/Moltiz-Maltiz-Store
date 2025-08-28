(()=>{
  // 슬라이드 데이터 (이미지 → 링크 + 제목)
  const slides = [
    {
      img: 'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/a6add642-72ad-4590-a7b4-693a837973c7.png',
      href: 'best.html',
      alt: '베스트 상품',
      title: 'Best Product'
    },
    {
      img: 'https://ninjastorage.blob.core.windows.net/companyfiles/205623498/adfcee20-baad-444b-b1c2-83fd9ce9ff17.png',
      href: 'event.html',
      alt: '이벤트',
      title: 'Event'
    },
    {
      img: 'https://i.pinimg.com/736x/80/bf/e5/80bfe5b09623565cc3a1d0d5bdd4964c.jpg',
      href: 'Gallery.html',
      alt: '갤러리',
      title: 'Gallery'
    },
    {
      img: 'https://i.pinimg.com/736x/f1/98/53/f19853a799aae2a5725a337fb9d4c9a3.jpg',
      href: 'store.html',
      alt: '스토어',
      title: 'Store'
    }
  ];

  const root   = document.querySelector('.promo-rotator');
  const linkEl = document.getElementById('promoLink');
  const imgEl  = document.getElementById('promoImg');
  const titleEl= document.getElementById('promoTitle');
  const dotsEl = document.getElementById('promoDots');
  const prevBtn= document.getElementById('promoPrev');  // ← 추가
  const nextBtn= document.getElementById('promoNext');  // ← 추가

  if (!root || !linkEl || !imgEl || !titleEl) return;

  const interval = parseInt(root.dataset.interval || '2000', 10);

  // 인디케이터 생성
  const dots = slides.map((_, i) => {
    const b = document.createElement('button');
    b.type='button';
    b.setAttribute('role','tab');
    b.setAttribute('aria-label', `${i+1}번째 슬라이드`);
    b.addEventListener('click', () => go(i, true));
    dotsEl.appendChild(b);
    return b;
  });

  // 이미지 미리 로드
  slides.forEach(s => { const im = new Image(); im.src = s.img; });

  let idx = 0;
  let timer = null;

  function render(){
    const s = slides[idx];
    imgEl.classList.remove('is-active');
    requestAnimationFrame(()=>{
      imgEl.src = s.img;
      imgEl.alt = s.alt || '';
      linkEl.href = s.href;
      titleEl.textContent = s.title;
      requestAnimationFrame(()=> imgEl.classList.add('is-active'));
    });

    dots.forEach((d,i)=> d.setAttribute('aria-selected', i===idx));
  }

  function next(){ idx = (idx+1) % slides.length; render(); }
  function prev(){ idx = (idx-1+slides.length) % slides.length; render(); }  // ← 추가
  function go(i, user=false){
    idx = (i+slides.length) % slides.length;
    render();
    if(user) restart();
  }

  function start(){ if(timer) return; timer = setInterval(next, interval); }
  function stop(){ clearInterval(timer); timer=null; }
  function restart(){ stop(); start(); }

  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);

   // ▶ 버튼 클릭 이벤트 (추가)
  prevBtn?.addEventListener('click', () => { prev(); restart(); });
  nextBtn?.addEventListener('click', () => { next(); restart(); });

  // ▶ 키보드 화살표로 이동 (섹션에 tabindex="0" 추가했음)
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); restart(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); restart(); }
  });

  render();
  start();
})();