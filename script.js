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
    '.evidence__heading > *', '.evidence__gallery', '.evidence__hint',
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
    for (const link of links) {
      if (current && link.getAttribute('href') === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  }

  function schedule() {
    if (frame === null) frame = window.requestAnimationFrame(sync);
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  sync();
})();
