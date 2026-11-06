(() => {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.site-menu-toggle');
  const navigation = document.querySelector('#primary-navigation');
  const brand = document.querySelector('.site-header .brand');
  if (!header) return;

  // Keep the header clear at the very top, then fade in its glass edge.
  // Scrolling never closes the menu (including delayed scroll events).
  function syncHeader() {
    header.classList.toggle('is-scrolled', window.scrollY > 4);
  }
  window.addEventListener('scroll', syncHeader, { passive: true });
  syncHeader();
  document.documentElement.classList.add('has-sticky-header');

  if (!toggle || !navigation || !window.matchMedia) return;
  const compactScreen = window.matchMedia('(max-width: 899px), (max-width: 1100px) and (max-height: 500px)');
  let menuOpen = false;

  function setMenuOpen(open) {
    menuOpen = open && compactScreen.matches;
    const closedOnMobile = compactScreen.matches && !menuOpen;
    // Reopen at the first link even if a short screen was scrolled to the contacts.
    if (menuOpen) navigation.scrollTop = 0;
    toggle.setAttribute('aria-expanded', String(menuOpen));
    toggle.setAttribute('aria-label', menuOpen ? 'Закрыть меню' : 'Открыть меню');
    header.classList.toggle('is-menu-open', menuOpen);
    document.documentElement.classList.toggle('menu-is-open', menuOpen);
    // Keep the drawer in the layout for its exit animation, but remove its
    // links from keyboard and assistive-technology navigation while closed.
    navigation.inert = closedOnMobile;
    if (closedOnMobile) navigation.setAttribute('aria-hidden', 'true');
    else navigation.removeAttribute('aria-hidden');
  }

  function syncLayout() {
    navigation.hidden = false;
    toggle.hidden = !compactScreen.matches;
    setMenuOpen(false);
  }

  toggle.addEventListener('click', () => setMenuOpen(!menuOpen));
  if (brand) brand.addEventListener('click', () => {
    if (menuOpen) setMenuOpen(false);
  });
  navigation.addEventListener('click', (event) => {
    if (menuOpen && event.target.closest('a[href]')) setMenuOpen(false);
  });
  document.addEventListener('click', (event) => {
    // The dimmed backdrop is a pseudo-element of the header itself.
    if (menuOpen && (event.target === header || !header.contains(event.target))) setMenuOpen(false);
  });
  document.addEventListener('focusin', (event) => {
    if (menuOpen && !header.contains(event.target)) setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (menuOpen && event.key === 'Escape') {
      setMenuOpen(false);
      toggle.focus();
    }
  });
  if (compactScreen.addEventListener) compactScreen.addEventListener('change', syncLayout);
  else compactScreen.addListener(syncLayout);
  syncLayout();
  document.documentElement.classList.add('has-menu');
})();

// Reveal content once as it enters the viewport. The initial viewport and all
// fallback cases remain visible, including without JavaScript or motion support.
(() => {
  if (!window.IntersectionObserver || !window.matchMedia) return;
  const motion = window.matchMedia('(prefers-reduced-motion: no-preference)');
  if (!motion.matches) return;

  const selectors = [
    '.about__heading', '.about__copy > p',
    '.section-heading > *', '.metrics > .metric',
    '.evidence__heading > *', '.evidence__gallery', '.evidence__hint', '.evidence__note',
    '.projects__intro', '.project-list > .project-card',
    '.tariffs > .tariff-card', '.services__extra',
    '.personal__title-wrap', '.personal__intro > *', '.personal__included-heading',
    '.personal__features > .personal-feature', '.personal__format',
    '.why__intro > *', '.why__group > h3', '.why__list > .why__item',
    '.contact__inner > :first-child', '.contact__copy > p', '.contact__copy > h3',
    '.contact__channels > div', '.contact__cta', '.footer__inner',
  ];
  // Measure first, then write classes to avoid repeated layout work.
  const targets = [...document.querySelectorAll(selectors.join(', '))]
    .filter((element) => element.getBoundingClientRect().top >= window.innerHeight);
  if (!targets.length) return;

  const observer = new window.IntersectionObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target;
      if (!element.classList.contains('scroll-reveal-pending')) continue;
      if (entry.isIntersecting) {
        element.classList.remove('scroll-reveal-pending');
        element.classList.add('scroll-reveal-enter');
        observer.unobserve(element);
      } else if (entry.boundingClientRect.bottom < 0) {
        // A fast jump past an element must not leave it invisible above the page.
        element.classList.remove('scroll-reveal-pending');
        observer.unobserve(element);
      }
    }
  }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });

  function showFocused(event) {
    const element = event.target.closest && event.target.closest('.scroll-reveal-pending, .scroll-reveal-enter');
    if (!element) return;
    element.classList.remove('scroll-reveal-pending', 'scroll-reveal-enter');
    observer.unobserve(element);
  }
  function finishAnimation(event) {
    if (event.animationName === 'scroll-reveal-rise') event.target.classList.remove('scroll-reveal-enter');
  }
  function stopForReducedMotion(event) {
    if (event.matches) return;
    observer.disconnect();
    targets.forEach((element) => element.classList.remove('scroll-reveal-pending', 'scroll-reveal-enter'));
    document.removeEventListener('focusin', showFocused);
    document.removeEventListener('animationend', finishAnimation);
    document.removeEventListener('animationcancel', finishAnimation);
    if (motion.removeEventListener) motion.removeEventListener('change', stopForReducedMotion);
    else if (motion.removeListener) motion.removeListener(stopForReducedMotion);
  }

  document.addEventListener('focusin', showFocused);
  document.addEventListener('animationend', finishAnimation);
  document.addEventListener('animationcancel', finishAnimation);
  if (motion.addEventListener) motion.addEventListener('change', stopForReducedMotion);
  else if (motion.addListener) motion.addListener(stopForReducedMotion);
  targets.forEach((element) => {
    element.classList.add('scroll-reveal-pending');
    observer.observe(element);
  });
})();

// Light the pill of the section currently under the header. The highlight is
// advisory only: without scripting the pills stay neutral, and measurements
// are throttled to a single pass per animation frame while scrolling.
(() => {
  if (!window.requestAnimationFrame || !window.getComputedStyle || typeof document.querySelectorAll !== 'function') return;
  const links = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = links
    .map((link) => document.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);
  if (!links.length || sections.length !== links.length) return;
  const tracked = [...document.querySelectorAll('main section[id]')];
  let frame = null;
  // Clicking a link commits the highlight to it while its smooth scroll runs,
  // so the marker glides straight to the chosen pill instead of sweeping
  // through the sections the page passes on its way. The lock releases once
  // the scroll comes to rest, and plain section tracking takes over again.
  let lockedId = null;
  let idleTimer = null;

  function holdLock() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { lockedId = null; schedule(); }, 150);
  }
  function sync() {
    frame = null;
    // The line rests just below the fixed header, where the eye is reading.
    const offset = parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--header-offset'));
    const line = (Number.isFinite(offset) ? offset : 92) + 24;
    let current = null;
    for (const section of tracked) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= line && rect.bottom > line) { current = '#' + section.id; break; }
    }
    if (lockedId) current = lockedId;
    for (const link of links) {
      if (current && link.getAttribute('href') === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  function schedule() {
    if (frame === null) frame = window.requestAnimationFrame(sync);
  }
  for (const link of links) {
    link.addEventListener('click', () => { lockedId = link.getAttribute('href'); holdLock(); schedule(); });
  }
  window.addEventListener('scroll', () => { if (lockedId) holdLock(); schedule(); }, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  sync();
})();

// A light thumb glides inside the navigation capsule: it previews the hovered
// or focused link and settles on the section in view. Decorative only — the
// links behave exactly the same without it.
(() => {
  if (!window.requestAnimationFrame || !window.matchMedia || typeof MutationObserver === 'undefined' || typeof document.querySelectorAll !== 'function' || typeof document.createElement !== 'function') return;
  const nav = document.querySelector('.site-nav');
  if (!nav || typeof nav.appendChild !== 'function') return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  if (!links.length) return;
  const roomy = window.matchMedia('(min-width: 900px) and (min-height: 501px), (min-width: 1101px)');
  const thumb = document.createElement('span');
  thumb.className = 'site-nav__thumb';
  thumb.setAttribute('aria-hidden', 'true');
  nav.appendChild(thumb);
  let frame = null;
  let preview = null;

  function currentLink() {
    return links.find((link) => link.getAttribute('aria-current') === 'true') || null;
  }
  function place(target) {
    if (!target) { thumb.style.opacity = '0'; return; }
    thumb.style.width = target.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + target.offsetLeft + 'px)';
    thumb.style.opacity = '1';
  }
  function settle() {
    frame = null;
    place(roomy.matches ? (preview || currentLink()) : null);
  }
  function schedule() {
    if (frame === null) frame = window.requestAnimationFrame(settle);
  }
  for (const link of links) {
    link.addEventListener('mouseenter', () => { preview = link; schedule(); });
    link.addEventListener('focus', () => { preview = link; schedule(); });
    link.addEventListener('mouseleave', () => { if (preview === link) { preview = null; schedule(); } });
    link.addEventListener('blur', () => { if (preview === link) { preview = null; schedule(); } });
  }
  // The scroll spy rewrites aria-current; the thumb quietly follows.
  const changes = new MutationObserver(schedule);
  for (const link of links) changes.observe(link, { attributes: true, attributeFilter: ['aria-current'] });
  if (roomy.addEventListener) roomy.addEventListener('change', schedule);
  else if (roomy.addListener) roomy.addListener(schedule);
  window.addEventListener('resize', schedule, { passive: true });
  // Link widths settle only once the fonts are in; re-measure then.
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(schedule);
  schedule();
})();

// Clicking a screenshot opens it large in a dialog. The link keeps working on
// its own without scripting: it simply shows the image file in a new tab.
(() => {
  'use strict';
  const dialog = document.querySelector('.evidence-lightbox');
  if (!dialog || typeof dialog.showModal !== 'function' || typeof document.querySelectorAll !== 'function') return;
  const image = dialog.querySelector('.evidence-lightbox__image');
  const caption = dialog.querySelector('.evidence-lightbox__caption');
  const closeButton = dialog.querySelector('.evidence-lightbox__close');
  const links = [...document.querySelectorAll('.evidence-card__link')];
  if (!image || !caption || !closeButton || !links.length) return;
  for (const link of links) {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const thumb = link.querySelector('img');
      if (!thumb) return;
      event.preventDefault();
      image.alt = thumb.getAttribute('alt') || '';
      const width = parseInt(thumb.getAttribute('width'), 10);
      const height = parseInt(thumb.getAttribute('height'), 10);
      if (width > 0 && height > 0) { image.width = width; image.height = height; }
      image.src = link.getAttribute('href');
      const card = link.closest('.evidence-card');
      const label = card ? card.querySelector('figcaption') : null;
      const parts = label ? [...label.querySelectorAll('span')] : [];
      caption.textContent = parts.map((part) => part.textContent.trim()).filter(Boolean).join(' · ');
      if (!dialog.open) dialog.showModal();
    });
  }
  closeButton.addEventListener('click', () => dialog.close());
  // A click on the dimmed backdrop closes the viewer as well.
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
})();
// An Instagram-style fan toast plays over the cooperation buttons. The red
// plaque arrives at once with a big follower count, the count climbs for
// five seconds, falls when the cursor leaves, and the plaque departs five
// seconds after that. Hovering again resumes the climb from the current
// count, so nobody waits for it to drain to zero.
(() => {
  'use strict';
  const toast = document.querySelector('.follow-toast');
  if (!toast || typeof toast.querySelector !== 'function' || typeof document.querySelectorAll !== 'function') return;
  if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
  const counter = toast.querySelector('.follow-toast__count');
  const label = toast.querySelector('.follow-toast__label');
  if (!counter || !label) return;
  const buttons = [...document.querySelectorAll('a[href^="https://t.me/"]')]
    .filter((link) => /сотрудничество/i.test(String(link.textContent || '')));
  if (!buttons.length) return;
  const GROW_MS = 5000;
  const FALL_MS = 5000;
  const TICK_MS = 600;
  let fans = 0;
  let live = false;
  let ticker = null;
  let phaseTimer = null;
  let fadeTimer = null;
  const stop = () => {
    if (ticker) { window.clearInterval(ticker); ticker = null; }
    if (phaseTimer) { window.clearTimeout(phaseTimer); phaseTimer = null; }
  };
  const render = () => { counter.textContent = fans.toLocaleString('ru-RU'); };
  function pour() {
    if (fadeTimer) { window.clearTimeout(fadeTimer); fadeTimer = null; }
    stop();
    if (!live) { fans = 6400 + Math.floor(Math.random() * 7400); live = true; }
    label.textContent = 'подписались на вас';
    toast.classList.add('is-visible');
    render();
    ticker = window.setInterval(() => {
      fans += 160 + Math.floor(Math.random() * 1340);
      render();
    }, TICK_MS);
    phaseTimer = window.setTimeout(() => {
      if (ticker) { window.clearInterval(ticker); ticker = null; }
    }, GROW_MS);
  }
  function drain() {
    stop();
    if (!live) return;
    label.textContent = 'отписываются…';
    ticker = window.setInterval(() => {
      fans = Math.max(0, fans - (90 + Math.floor(Math.random() * 720)));
      render();
    }, TICK_MS);
    phaseTimer = window.setTimeout(() => {
      stop();
      toast.classList.remove('is-visible');
      fadeTimer = window.setTimeout(() => { fans = 0; live = false; fadeTimer = null; }, 400);
    }, FALL_MS);
  }
  for (const button of buttons) {
    button.addEventListener('mouseenter', pour);
    button.addEventListener('focus', pour);
    button.addEventListener('mouseleave', drain);
    button.addEventListener('blur', drain);
  }
})();

// Project cards behave like a polite accordion: opening one folds the other,
// and the case details glide in and out by height. Native <details> keeps
// working without scripting; reduced motion skips the glide entirely.
(() => {
  'use strict';
  const list = typeof document.querySelector === 'function' ? document.querySelector('.project-list') : null;
  if (!list || typeof list.querySelectorAll !== 'function') return;
  const cards = [...list.querySelectorAll('.project-card')]
    .filter((card) => card && typeof card.querySelector === 'function' && card.querySelector('summary'));
  if (!cards.length) return;
  const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : null;
  const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  const glide = 'height .42s cubic-bezier(.22, 1, .36, 1)';
  function settle(card, body, closing) {
    if (card.__glide) window.clearTimeout(card.__glide);
    card.__glide = window.setTimeout(() => {
      card.__glide = null;
      card.dataset.state = '';
      if (closing) card.open = false;
      if (body) body.style.cssText = '';
    }, 450);
  }
  function collapse(card) {
    if (card.dataset.state === 'closing') return;
    card.dataset.state = 'closing';
    const body = card.querySelector('.project-card__details');
    if (!body || !raf || reduce) { card.open = false; card.dataset.state = ''; return; }
    const from = body.offsetHeight;
    body.style.transition = 'none';
    body.style.height = from + 'px';
    body.style.overflow = 'hidden';
    void body.offsetHeight;
    body.style.transition = glide;
    body.style.height = '0px';
    settle(card, body, true);
  }
  function expand(card) {
    if (card.dataset.state === 'opening') return;
    card.dataset.state = 'opening';
    card.open = true;
    const body = card.querySelector('.project-card__details');
    if (!body || !raf || reduce) { card.dataset.state = ''; return; }
    const from = card.__glide ? body.offsetHeight : 0;
    body.style.transition = 'none';
    body.style.height = from + 'px';
    body.style.overflow = 'hidden';
    void body.offsetHeight;
    body.style.transition = glide;
    body.style.height = body.scrollHeight + 'px';
    settle(card, body, false);
  }
  for (const card of cards) {
    const summary = card.querySelector('summary');
    if (!summary || typeof summary.addEventListener !== 'function') continue;
    summary.addEventListener('click', (event) => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      for (const other of cards) if (other !== card && other.open) collapse(other);
      const closing = card.dataset.state === 'closing';
      if (card.open && !closing) collapse(card);
      else expand(card);
    });
  }
})();
