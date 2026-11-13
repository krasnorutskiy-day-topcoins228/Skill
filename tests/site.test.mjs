import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const read = (path) => existsSync(path) ? readFileSync(path, 'utf8') : '';
const html = read('index.html');
const css = read('styles.css');

test('the page introduces Elizaveta and the supplied experience', () => {
  assert.match(html, /<html[^>]+lang="ru"/i);
  assert.match(html, /<meta[^>]+name="viewport"/i);
  assert.match(html, /Елизавета Кравец/i);
  assert.match(html, /SMM-специалист/i);
  assert.match(html, /2019/);
});

test('about copy keeps every paragraph at the introduction size without the experience badge', () => {
  const about = html.match(/<section class="about section section--wine"[\s\S]*?<\/section>/)?.[0];
  assert.ok(about, 'About section is missing');
  assert.doesNotMatch(about, /\bexperience(?:__[\w-]+)?\b/);
  const copy = about.match(/<div class="about__copy">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(copy, 'About copy is missing');
  const paragraphs = [...copy.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, content]) => content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
  assert.deepEqual(paragraphs, [
    'Меня зовут Елизавета Кравец. Я работаю в сфере SMM и digital-маркетинга с 2019 года.',
    'За это время успела поработать с проектами на российском и зарубежном рынках, сотрудничать с digital-агентствами, развивать собственные проекты и выстраивать работу собственной команды.',
    'За 7 лет в профессии я прошла путь от создания контента до комплексного управления SMM-проектами. Постоянно слежу за изменениями digital-среды, изучаю новые инструменты продвижения и адаптирую стратегии под современные алгоритмы социальных сетей.',
    'В своей работе объединяю аналитику, стратегическое планирование, креатив и создание контента. Для меня SMM — это не просто регулярные публикации, а системная работа над узнаваемостью бренда, развитием аудитории и достижением бизнес-целей.',
    'Помогаю бизнесу и личным брендам развиваться в социальных сетях: от разработки SMM-стратегии до реализации контента и анализа результатов.',
  ]);
  assert.match(copy, /<strong>Елизавета Кравец\.<\/strong>/);
  assert.match(copy, /<p class="about__statement">/);
  assert.match(css, /\.about__copy\s*\{[^}]*font-size:\s*23px/);
  assert.match(css, /\.about__copy\s*\{[^}]*gap:\s*19px/, 'The about text keeps its original paragraph rhythm');
  assert.match(css, /--text-on-wine:\s*#eaf4ff/, 'Wine surfaces get a brighter ink for readability');
  assert.match(css, /\.section--wine\s*\{[^}]*color:\s*var\(--text-on-wine\)/, 'Wine sections use the brighter ink');
  assert.match(css, /\.about__lead\s*\{[^}]*font-size:\s*inherit/);
  assert.match(css, /\.about__statement\s*\{[^}]*font-size:\s*inherit/);
  const tabletRules = css.match(/@media\s*\(min-width:\s*600px\)\s*\{([\s\S]*?)\n\}/)?.[1];
  const desktopRules = css.match(/@media\s*\(min-width:\s*900px\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(tabletRules && desktopRules, 'Responsive about styles are missing');
  assert.match(tabletRules, /\.about__copy\s*\{[^}]*font-size:\s*24px/);
  assert.match(desktopRules, /\.about__copy\s*\{[^}]*font-size:\s*25px/);
  const photos = about.match(/<div class="about__photos">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(photos, 'The about photos block is missing');
  assert.equal((photos.match(/<figure class="about__photo/g) || []).length, 2, 'Two photos accompany the heading');
  assert.match(photos, /assets\/about-photo-01\.jpg/);
  assert.match(photos, /assets\/about-photo-02\.jpg/);
  assert.match(photos, /loading="lazy"/);
  assert.match(css, /\.about__photos\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(0, 1fr\)/, 'On phones the photos pair up side by side');
  assert.match(css, /\.about__photo--offset\s*\{[^}]*margin-top:\s*18px/, 'On phones the second photo drops just a touch');
  assert.match(css, /\.about__photo img\s*\{[^}]*border-radius:\s*20px/);
  assert.match(tabletRules, /\.about__photos\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'From tablets the photos stack into the diagonal cascade');
  assert.match(tabletRules, /\.about__photo\s*\{[^}]*width:\s*60%/, 'In the cascade the first photo keeps left');
  assert.match(tabletRules, /\.about__photo--offset\s*\{[^}]*justify-self:\s*end/, 'In the cascade the second photo swings right');
  assert.doesNotMatch(tabletRules, /\.about__copy\s*\{[^}]*gap/, 'Tablets keep the original rhythm');
  assert.doesNotMatch(desktopRules, /\.about__copy\s*\{[^}]*line-height/, 'Desktop keeps the original line height');
});

test('the requested decorative captions are absent while the introduction remains', () => {
  const hero = html.match(/<section class="hero"[\s\S]*?<\/section>/)?.[0];
  assert.ok(hero, 'Hero section is missing');
  for (const removed of ['SMM &amp; DIGITAL-МАРКЕТИНГ', 'С 2019 ГОДА', 'ПРОДВИЖЕНИЕ СО СМЫСЛОМ', 'ЛИСТАЙТЕ НИЖЕ', '01 — 04']) {
    assert.ok(!html.includes(removed), `Unexpected caption: ${removed}`);
  }
  assert.match(hero, /SMM-специалист/);
  assert.match(hero, /hero__actions/);
  assert.doesNotMatch(hero, /hero__eyebrow|hero__bottom/);
  const title = hero.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0];
  assert.ok(title, 'Hero title is missing');
  assert.doesNotMatch(title, /✳|hero__asterisk/, 'The decorative snowflake should not appear beside the name');
});

test('navigation and internal links point to existing sections', () => {
  for (const id of ['about', 'results', 'projects', 'services', 'personal-brand', 'contact']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
  for (const id of ['about', 'results', 'projects', 'services', 'personal-brand', 'contact']) {
    assert.match(html, new RegExp(`href=["']#${id}["']`));
  }
  for (const [, id] of html.matchAll(/href=["']#([^"']+)["']/g)) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `Missing anchor: ${id}`);
  }
});

test('navigation is a modern segmented control with a gliding light thumb', () => {
  const nav = html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav, 'Navigation is missing');
  assert.equal((nav.match(/<a class="glass-pill"/g) || []).length, 5);
  assert.match(nav, /<a class="glass-pill" href="#contact">Контакты<\/a>/, 'The capsule ends with a contacts link');
  assert.doesNotMatch(nav, /glass-pill__index/, 'The desktop capsule carries no numbered indices');
  const rule = css.match(/\.site-nav\s*\{([^}]*)\}/)?.[1];
  const pill = css.match(/\.glass-pill\s*\{([^}]*)\}/)?.[1];
  const header = css.match(/\.site-header\s*\{([^}]*)\}/)?.[1];
  assert.ok(rule && pill && header);
  assert.match(rule, /gap:\s*24px/);
  const height = Number(pill.match(/min-height:\s*([\d.]+)px/)?.[1]);
  assert.ok(Math.abs(height * 1.5 - 104) < 0.001, 'Keep the requested smaller drawer button height');
  assert.ok(height >= 44, 'Keep a comfortable touch target');
  assert.match(pill, /font-size:\s*20px/);
  assert.match(pill, /border:\s*1px solid/);
  assert.match(pill, /border-radius:\s*999px/);
  assert.match(pill, /radial-gradient\(/);
  assert.match(pill, /linear-gradient\(/);
  assert.match(pill, /backdrop-filter:\s*blur\(20px\)\s*saturate\(/);
  assert.match(pill, /box-shadow:\s*inset[^;]*,\s*0 12px/);
  assert.match(css, /\.glass-pill::before\s*\{/);
  assert.doesNotMatch(header, /border|box-shadow/);
  const desktop = css.match(/@media\s*\(min-width:\s*900px\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(desktop, 'Desktop navigation styles are missing');
  assert.match(desktop, /\.site-header__inner\s*\{[^}]*flex-wrap:\s*nowrap/);
  const band = css.match(/@media\s*\(min-width:\s*900px\)\s*and\s*\(min-height:\s*501px\),\s*\(min-width:\s*1101px\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(band, 'The segmented navigation is missing');
  assert.match(band, /\.site-nav\s*\{[^}]*display:\s*inline-flex/, 'The links sit in one capsule');
  assert.match(band, /\.site-nav\s*\{[^}]*gap:\s*8px/, 'The links keep a touch more air between them');
  assert.match(band, /\.site-nav\s*\{[^}]*backdrop-filter:\s*blur\(24px\)/);
  assert.match(band, /\.site-nav\s*\{[^}]*inset 0 1px 0 rgba\(255,\s*255,\s*255/);
  assert.match(band, /\.site-nav__thumb\s*\{[^}]*border-radius:\s*999px/);
  assert.match(band, /\.site-nav__thumb\s*\{[^}]*transition:[^}]*transform/, 'The thumb glides on transform only');
  assert.match(band, /\.site-nav__thumb\s*\{[^}]*pointer-events:\s*none/, 'The thumb never blocks the links');
  assert.match(band, /\.site-nav__thumb\s*\{[^}]*radial-gradient\(/, 'The thumb gets a glossy iOS highlight');
  assert.match(band, /\.site-nav\s+\.glass-pill\s*\{[^}]*background:\s*none/, 'Desktop links drop the separate button frames');
  assert.match(band, /\.site-nav\s+\.glass-pill\s*\{[^}]*min-height:\s*76px/, 'Keep the capsule tall and comfortable');
  assert.match(band, /\.site-nav\s+\.glass-pill\s*\{[^}]*padding-inline:\s*clamp\(14px,\s*1\.8vw,\s*48px\)/, 'Five pills stay compact enough to share one row');
  assert.match(band, /\.site-nav\s+\.glass-pill\[aria-current="true"\]\s*\{[^}]*color:\s*var\(--ink-on-ice\)/, 'The active link inverts on the light thumb');
  assert.match(band, /\.site-nav\s+\.glass-pill:hover\s*\{[^}]*color:\s*var\(--ink-on-ice\)/, 'The hovered link inverts too');
  const wide = css.match(/@media\s*\(min-width:\s*1220px\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(wide, 'Wide-screen navigation styles are missing');
  assert.match(wide, /\.site-header__inner\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\b/, 'Wide-screen capsule hugs the right edge');
  assert.match(wide, /\.site-nav\s*\{[^}]*grid-column:\s*2/);
  assert.match(wide, /\.brand\s*\{[^}]*margin-left:\s*min\(0px,\s*calc\(\(1364px\s*-\s*100vw\)\s*\/\s*4\)\)/, 'The logo drifts toward the left edge on wide screens');
  assert.match(wide, /\.site-nav\s+\.glass-pill\s*\{[^}]*font-size:\s*21px/, 'Wide-screen labels grow with the capsule');
  assert.match(css, /@media\s*\(min-width:\s*1101px\)\s*\{[^}]*\.site-nav\s*\{[^}]*margin-right:\s*clamp\(56px,\s*6vw,\s*112px\)/, 'The capsule keeps a breath of air from the right edge');
  assert.match(css, /@media\s*\(min-width:\s*1101px\)\s*\{[\s\S]*?\.site-nav\s+\.glass-pill\s*\{[^}]*padding-inline:\s*clamp\(24px,\s*2\.6vw,\s*60px\)/, 'The capsule stretches longer once the screen has room');
  assert.match(css, /@media\s*\(min-width:\s*1000px\)\s*and\s*\(max-width:\s*1100px\)\s*\{[^}]*\.site-nav\s+\.glass-pill\s*\{[^}]*padding-inline:\s*clamp\(20px,\s*2\.6vw,\s*34px\)/, 'The mid-band buttons stretch too');
});

test('the gliding thumb follows the section in view without extra ornaments', () => {
  const js = read('script.js');
  assert.doesNotMatch(html, /glass-pill__index/, 'The capsule drops the numbered indices');
  assert.match(css, /\.site-nav\s+\.glass-pill\[aria-current="true"\]\s*\{[^}]*border-color/, 'The drawer keeps its warm active edge');
  assert.match(js, /site-nav__thumb/, 'The thumb is created by the script');
  assert.match(js, /MutationObserver/, 'The thumb follows the section in view');
  assert.match(js, /offsetLeft/, 'The thumb measures its target link');
  assert.match(js, /document\.fonts/, 'The thumb re-measures once fonts load');
  assert.match(js, /requestAnimationFrame/, 'Section tracking is throttled to animation frames');
  assert.match(js, /lockedId/, 'Clicking a link locks the highlight while its smooth scroll runs');
  assert.match(js, /lockedId = null;\s*schedule\(\)/, 'The lock releases once the scroll comes to rest');
  assert.match(js, /evidence-lightbox/, 'Screenshots open in a lightbox dialog');
  assert.match(js, /showModal/, 'The lightbox uses the native dialog element');
  assert.match(js, /setAttribute\('aria-current',\s*'true'\)/);
  assert.match(js, /removeAttribute\('aria-current'\)/);
  assert.match(js, /--header-offset/);
  assert.match(js, /\{ passive: true \}/);
});

test('mobile menu uses simple bars and narrower, taller glass buttons without a rose', () => {
  const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0];
  const button = header?.match(/<button class="site-menu-toggle"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(button, 'The mobile menu button is missing');
  assert.match(header, /class="brand"/);
  assert.match(button, /type="button"/);
  assert.match(button, /aria-label="Открыть меню"/);
  assert.match(button, /aria-controls="primary-navigation"/);
  assert.match(button, /aria-expanded="false"/);
  assert.match(button, /\shidden(?:\s|>)/);
  assert.equal((button.match(/<i><\/i>/g) || []).length, 3, 'The toggle should display three bars');
  assert.doesNotMatch(button, /<span>Меню<\/span>/, 'Keep the visible control as an icon');
  const nav = html.match(/<nav class="site-nav" id="primary-navigation"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(nav);
  assert.doesNotMatch(nav, /РАЗДЕЛЫ|site-nav__eyebrow|site-nav__contacts/i, 'No old eyebrow headings or contact blocks in the menu');
  assert.doesNotMatch(nav, /<h[1-6][^>]*>[^<]*КОНТАКТЫ/i, 'The menu keeps its retired headline style retired');
  const social = [...nav.matchAll(/<a class="site-nav__social"[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
  assert.equal(social.length, 2);
  assert.match(social[0], /href="https:\/\/t\.me\/lizzieamo"[^>]*aria-label="[^"]+"/);
  assert.match(social[1], /href="mailto:unicorn\.lyyy@gmail\.com"[^>]*aria-label="[^"]+"/);
  assert.ok(social.every(link => /<svg\b[^>]*aria-hidden="true"/.test(link)));
  assert.match(nav, /<a class="site-nav__phone" href="tel:\+79697007993">\+7 \(969\) 700-79-93<\/a>/);
  assert.ok(nav.indexOf('site-nav__socials') < nav.indexOf('site-nav__phone'));
  assert.doesNotMatch(nav, /site-nav__rose|menu-rose/, 'Keep the menu free of the decorative rose');
  const lines = css.match(/\.site-menu-toggle__icon i\s*\{([^}]*)\}/)?.[1];
  assert.ok(lines);
  assert.match(lines, /width:\s*100%/);
  assert.match(lines, /background:\s*currentColor/);
  assert.doesNotMatch(lines, /gradient|box-shadow/);
  const middleLine = css.match(/\.site-menu-toggle__icon i:nth-child\(2\)\s*\{([^}]*)\}/)?.[1];
  assert.ok(middleLine);
  assert.doesNotMatch(middleLine, /width:/, 'All three bars should be equal in length');
  const mobilePill = css.match(/\.has-menu\s+\.site-nav\s+\.glass-pill\s*\{([^}]*)\}/)?.[1];
  assert.ok(mobilePill, 'Mobile glass buttons are missing');
  assert.match(mobilePill, /width:\s*min\(300px,\s*78vw,\s*100%\)/);
  assert.match(mobilePill, /min-height:\s*64px/);
  assert.match(mobilePill, /font-size:\s*22px/);
  assert.match(mobilePill, /radial-gradient\([\s\S]*linear-gradient\(/);
  assert.match(mobilePill, /backdrop-filter:\s*blur\(24px\)/);
  assert.match(mobilePill, /box-shadow:\s*inset/);
  assert.match(html, /<script src="script\.js\?[^\"]+" defer><\/script>/);
  assert.ok(existsSync('script.js'));
  assert.match(css, /\.has-menu\s+\.site-nav\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.has-menu\s+\.site-nav\s*\{[^}]*transform:\s*translateY\(-100%\)/);
  assert.match(css, /\.has-menu\s+\.site-header\.is-menu-open\s+\.site-nav\s*\{[^}]*transform:\s*translateY\(0\)/);
  assert.match(css, /\.has-menu\s+\.site-header\.is-menu-open\s+\.site-header__inner::after\s*\{[^}]*position:\s*fixed/);
  assert.match(css, /\.site-menu-toggle\[aria-expanded="true"\][^}]*rotate\(45deg\)/);
  assert.match(css, /\.site-menu-toggle\[aria-expanded="true"\][^}]*rotate\(-45deg\)/);
  assert.match(css, /\.site-menu-toggle\[hidden\],\s*\.site-nav\[hidden\]\s*\{[^}]*display:\s*none/);
});

test('the open mobile menu and its header share the same burgundy surface', () => {
  const top = css.match(/\.has-menu\s+\.site-header\.is-menu-open\s+\.site-header__inner::after\s*\{([^}]*)\}/)?.[1];
  const drawer = css.match(/\.has-menu\s+\.site-nav\s*\{([^}]*)\}/)?.[1];
  assert.ok(top && drawer, 'Mobile menu surfaces are missing');
  assert.match(top, /background:\s*var\(--wine\)/);
  assert.match(drawer, /background:\s*var\(--wine\)/);
  assert.doesNotMatch(top, /border-bottom/);
});

test('the header stays fixed and its glass edge fades in only after scrolling', () => {
  assert.match(css, /\.has-sticky-header\s+\.site-header\s*\{[^}]*position:\s*fixed/);
  const edge = css.match(/\.site-header::after\s*\{([^}]*)\}/)?.[1];
  assert.ok(edge, 'The scroll edge is missing');
  assert.match(edge, /border-bottom:\s*1px solid/);
  assert.match(edge, /backdrop-filter:\s*blur\(/);
  assert.match(edge, /opacity:\s*0/);
  assert.match(edge, /transition:\s*opacity/);
  assert.match(css, /\.site-header\.is-scrolled::after\s*\{[^}]*opacity:\s*1/);
  assert.match(css, /\.section\s*\{[^}]*scroll-margin-top:\s*var\(--header-offset\)/);
  assert.match(css, /main\s*>\s*\.section:not\(\.about\)\s*\{[^}]*scroll-margin-top:\s*max\(/);
});

test('the header no longer contains the removed contact button', () => {
  const header = html.match(/<header\b[\s\S]*?<\/header>/)?.[0];
  assert.ok(header, 'Header is missing');
  assert.doesNotMatch(header, /header-contact|На связи/i);
  assert.doesNotMatch(css, /\.header-contact\b/);
  assert.match(html, /class="button button--glass" href="https:\/\/t\.me\/lizzieamo"/,
    'Removing the header button should not remove the Telegram call to action');
});

test('large hero calls to action have more space and no arrows', () => {
  const actions = html.match(/<div class="hero__actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(actions, 'Hero actions are missing');
  const links = [...actions.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map(match => match[1]);
  assert.equal(links.length, 2);
  assert.match(links[0], /Посмотреть проекты/);
  assert.match(links[1], /Обсудить сотрудничество/);
  for (const link of links) assert.doesNotMatch(link, /<svg\b|[↗→↓]/);
  const serviceLink = html.match(/<a class="text-link"[^>]*>([\s\S]*?)<\/a>/)?.[1];
  assert.ok(serviceLink);
  assert.match(serviceLink, /Обсудить сотрудничество/);
  assert.doesNotMatch(serviceLink, /<svg\b|[↗→↓]/);
  assert.match(css, /\.hero__actions\s*\{[^}]*gap:\s*20px/);
  assert.match(css, /\.button\s*\{[^}]*justify-content:\s*center/);
  assert.match(css, /\.button\s*\{[^}]*min-height:\s*76px/);
  assert.match(css, /\.button\s*\{[^}]*font-size:\s*20px/);
});

test('the role is above the name without forced line breaks', () => {
  const content = html.match(/<div class="hero__content">([\s\S]*?)<div class="hero__actions">/)?.[1];
  assert.ok(content, 'Hero content is missing');
  const role = content.match(/<p class="hero__role">([\s\S]*?)<\/p>/);
  assert.ok(role, 'The role is missing');
  assert.ok(content.indexOf(role[0]) < content.indexOf('<h1'), 'The role must be above the name');
  assert.doesNotMatch(role[1], /<br\b/i, 'Let the text wrap naturally on narrow screens');
  assert.equal(role[1].trim(), 'SMM-специалист / Стратегия, продвижение и создание контента');
  assert.match(css, /\.hero__role\s*\{[^}]*font-size:\s*21px/);
  assert.match(css, /\.hero__description\s*\{[^}]*font-size:\s*22px/);
  assert.match(css, /\.hero__role\s*\{[^}]*font-size:\s*25px/, 'The desktop role grows with the layout');
  assert.match(css, /\.hero h1\s*\{[^}]*font-size:\s*clamp\(5rem,\s*7\.7vw,\s*7\.5rem\)/, 'The name scales up on wide screens');
  assert.match(css, /\.hero__description\s*\{[^}]*font-size:\s*25px/, 'The desktop description keeps pace');
});

test('phone hero keeps the cloche and still petals visible with readable, compact actions', () => {
  const phone = css.match(/@media\s*\(max-width:\s*599px\)\s*\{([^{}]*\.hero__petals\s*\{[^}]*\}[\s\S]*?)\n\}/)?.[1];
  assert.ok(phone, 'Phone hero styles are missing');
  assert.match(phone, /\.hero__petals\s*\{[^}]*display:\s*none/);
  assert.match(phone, /\.has-menu\s+\.hero__inner\s*\{[^}]*padding-top:\s*112px/);
  assert.match(phone, /\.hero\s+h1\s*\{[^}]*font-size:\s*clamp\(3\.125rem,\s*13\.4vw/);
  assert.match(phone, /\.hero__description\s*\{[^}]*font-size:\s*20px/);
  assert.match(phone, /\.hero__actions\s+\.button\s*\{[^}]*width:\s*min\(225px,\s*62vw\)[^}]*min-height:\s*64px/);
  assert.match(phone, /\.hero__image\s*\{[^}]*top:\s*max\(188px,\s*calc\(100svh\s*-\s*630px\)\)[^}]*bottom:\s*auto/);
  assert.match(css, /@media\s*\(max-width:\s*599px\)\s*and\s*\(max-height:\s*700px\)\s*and\s*\(orientation:\s*portrait\)[\s\S]*?\.hero::after\s*\{[^}]*rose-petal-tabletop\.png/);
  assert.match(css, /@media\s*\(max-width:\s*1100px\)\s*and\s*\(max-height:\s*500px\)\s*and\s*\(orientation:\s*landscape\)[\s\S]*?\.hero__petals\s*\{[^}]*display:\s*none/);
});

test('the logo is proportionally smaller and every section keeps a larger label', () => {
  const brand = css.match(/\.brand\s*\{([^}]*)\}/)?.[1];
  const monogram = css.match(/\.brand__monogram\s*\{([^}]*)\}/)?.[1];
  const name = css.match(/\.brand__name\s*\{([^}]*)\}/)?.[1];
  const dot = css.match(/\.brand__monogram\s+i\s*\{([^}]*)\}/)?.[1];
  assert.ok(brand && monogram && name && dot);
  const px = (rule, property) => Number(rule.match(new RegExp(`${property}:\\s*([\\d.]+)px`))?.[1]);
  for (const [rule, property, previous] of [[brand, 'gap', 24], [monogram, 'font-size', 78],
    [monogram, 'padding-right', 10], [name, 'font-size', 28], [dot, 'width', 10], [dot, 'height', 10]]) {
    assert.ok(Math.abs(px(rule, property) * 1.5 - previous) < 0.001, `${property} should be 1.5 times smaller`);
  }
  assert.match(css, /\.section-label\s*\{[^}]*font-size:\s*18px/);
  assert.match(css, /\.section-label\s*>\s*span\s*\{[^}]*font-size:\s*18px/);
  for (const id of ['about', 'results', 'projects', 'services', 'personal-brand', 'why-smm', 'contact']) {
    const section = html.match(new RegExp(`<section\\b[^>]*id="${id}"[\\s\\S]*?<\\/section>`))?.[0];
    assert.ok(section && /class="section-label(?:\s|\")/.test(section), `${id} needs a section label`);
  }
});

test('the supplied result and its evidence gallery are present', () => {
  assert.match(html, /3(?:\s|&nbsp;|&#160;)*000/);
  assert.match(html, /с нуля/i);
  assert.match(html, /два месяца/i);
  assert.match(html, /metric--feature/);
  assert.match(html, /2(?:\s|&nbsp;|&#160;)*900(?:\s|&nbsp;|&#160;)*000/, 'The Reels views figure is stated');
  assert.match(html, /1(?:\s|&nbsp;|&#160;)*500(?:\s|&nbsp;|&#160;)*000/, 'The total reach figure is stated');
  assert.doesNotMatch(html, /ХХХ/, 'No placeholder figures remain');
  assert.doesNotMatch(html, /ЭФФЕКТИВНОСТЬ|Другой результат проекта/, 'The generic efficiency metric stays retired');
  assert.match(html, /evidence__gallery/);
  assert.match(html, /Выращено\s*<em>с нуля<\/em>/, 'The evidence heading tells the from-scratch story with an italic accent');
  assert.match(html, /первый Reels/i, 'The first-Reels story is told');
  assert.match(html, /8(?:\s|&nbsp;|&#160;)*000/, 'The 8,000-follower Reels figure is stated');
  assert.match(html, /Не только подписчики/, 'The funnel note leads with its point');
  assert.match(html, /воронк/i, 'The Reels funnel is named');
  assert.match(html, /ПЕРВЫЙ REELS/, 'The last card is captioned as the debut Reels');
  assert.equal((html.match(/Показатель уточняется/g) || []).length, 0, 'The pending captions are retired');
  assert.match(css, /\.evidence__note\s*\{[^}]*background:\s*var\(--wine\)/, 'The funnel note is a wine callout');
  assert.match(css, /\.evidence-card__screen\s*\{[^}]*box-shadow/, 'The screenshot cards rest on a soft shadow');
  assert.match(css, /@media \(hover: hover\)\s*\{[\s\S]*?\.evidence-card:hover \.evidence-card__screen\s*\{[^}]*translateY\(-4px\)/, 'Cards lift gently on hover');
  assert.match(css, /\.evidence-lightbox\s*\{[^}]*background:\s*var\(--wine\)/, 'The lightbox viewer keeps the wine surface');
  assert.doesNotMatch(html, /Место для/, 'No leftover screenshot placeholders');
  assert.equal((html.match(/<img src="assets\/account-0\d\.jpg"/g) || []).length, 8, 'Eight real screenshots in the gallery');
  assert.equal((html.match(/class="evidence-card__link"/g) || []).length, 8, 'Every screenshot opens larger');
  for (let i = 1; i <= 8; i += 1) {
    const asset = `account-0${i}.jpg`;
    assert.ok(existsSync(`assets/${asset}`), `Missing screenshot: ${asset}`);
    assert.ok(html.includes(`assets/${asset}`), `${asset} must be shown in the gallery`);
  }
  assert.match(html, /<dialog class="evidence-lightbox"/, 'The lightbox dialog is present');
  assert.match(css, /\.evidence-card__screen img\s*\{[^}]*width:\s*100%/, 'Screenshots fill their cards without cropping');
  assert.match(css, /\.evidence-card__screen img\s*\{[^}]*max-height:\s*440px[^}]*object-fit:\s*contain/, 'Tall phone screenshots stay in rhythm without cropping');
  assert.match(css, /\.evidence__gallery\s*\{[^}]*display:\s*flex/, 'The scroller flexes so each card picks its own width');
  assert.match(css, /@media\s*\(min-width:\s*900px\)\s*\{[\s\S]*?\.evidence-card:nth-child\(4\)\s*\{[^}]*order:\s*1/, 'The matching phone screenshots gather beside 04');
  assert.match(css, /@media\s*\(min-width:\s*900px\)\s*\{[\s\S]*?\.evidence-card:nth-child\(5\)\s*\{[^}]*order:\s*4/, 'The mixed pair drops to the third row');
});

test('both project categories open to show the requested case fields', () => {
  assert.ok((html.match(/<details\b/g) || []).length >= 2);
  for (const field of ['Срок сотрудничества', 'Стартовая точка', 'Задачи', 'Результаты']) {
    assert.ok(html.includes(field), `Missing case field: ${field}`);
  }
});

test('services show the four supplied packages and distinguish the video editing add-on', () => {
  const services = html.match(/<section\b[^>]*id="services"[\s\S]*?<\/section>/)?.[0];
  assert.ok(services, 'Services section is missing');
  assert.match(services, /Тарифы на комплексное ведение/);
  assert.match(services, /<ul class="tariffs" role="list" aria-labelledby="tariffs-title">/);
  const text = content => content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const tariffs = [...services.matchAll(/<li class="tariff-card(?: tariff-card--package)?">([\s\S]*?)<\/li>/g)]
    .map(([, content]) => text(content));
  assert.deepEqual(tariffs, [
    'Базовый 50 000 ₽ До 30 единиц Посты, Reels и карусели в месяц Комплексное SMM-ведение без монтажа видеороликов.',
    'Базовый + монтаж 80 000 ₽ До 30 единиц Включая монтаж до 30 видео Полное ведение социальных сетей и производство видеоконтента из предоставленных исходников.',
    'Расширенный 65 000 ₽ До 60 единиц Посты, Reels и карусели в месяц Увеличенный объём контента для активного развития социальных сетей.',
    'Расширенный + монтаж 100 000 ₽ До 60 единиц контента и монтаж Комплексное ведение с дополнительным производством видеоконтента. Пакетная цена Выгоднее раздельного заказа услуг.',
  ]);
  const extra = services.match(/<aside class="services__extra"[\s\S]*?<\/aside>/)?.[0];
  assert.ok(extra, 'Video editing must be presented separately');
  assert.match(extra, /ДОПОЛНИТЕЛЬНАЯ УСЛУГА/);
  assert.match(extra, /Монтаж видео/);
  assert.match(extra, /за дополнительную стоимость/);
  assert.match(extra, /href="https:\/\/t\.me\/lizzieamo"/);
  assert.doesNotMatch(text(extra), /\d|₽/, 'Do not invent a separate video editing price');
  assert.doesNotMatch(services, /СКОРО ЗДЕСЬ|появится здесь позже/i);
});

test('personal brand support preserves the supplied scope, format, and monthly price', () => {
  assert.match(css, /\.personal__included\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.personal__included-heading\s+h3\s*\{[^}]*overflow-wrap:\s*anywhere/);
  const section = html.match(/<section\b[^>]*id="personal-brand"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, 'Personal brand section is missing');
  assert.match(html, /href="#personal-brand"/);
  assert.match(section, /<span>05<\/span>/);
  const text = content => content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const intro = section.match(/<div class="personal__intro">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(intro);
  assert.match(text(intro), /SMM-сопровождение личного бренда/);
  assert.deepEqual([...intro.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, content]) => text(content)), [
    'Помогаю экспертам, предпринимателям и специалистам развивать личный бренд, формировать узнаваемость и привлекать целевую аудиторию через социальные сети.',
    'Это формат ежемесячного профессионального сопровождения, при котором вы самостоятельно ведёте свой аккаунт, а я отвечаю за стратегию, контентное направление и маркетинговую составляющую.',
    'Вы получаете не просто список идей для публикаций, а системный подход к развитию блога и поддержку SMM-специалиста на протяжении всего месяца.',
  ]);
  const groups = [...section.matchAll(/<details class="personal-feature"( open)?>([\s\S]*?)<\/details>/g)];
  assert.equal(groups.length, 5);
  assert.ok(!groups.some(([, attr]) => attr), 'All groups start collapsed');
  const expectedGroups = [
    ['1. Анализ и позиционирование', [
      'Анализ текущего аккаунта.',
      'Изучение вашей экспертности, опыта и сильных сторон.',
      'Формирование позиционирования личного бренда.',
      'Определение целевой аудитории.',
      'Анализ интересов, потребностей и болей потенциальных подписчиков.',
      'Определение целей развития блога.',
    ]],
    ['2. Разработка SMM-стратегии', [
      'Создание индивидуальной стратегии продвижения.',
      'Формирование основных контентных направлений.',
      'Разработка контентных рубрик.',
      'Определение tone of voice и особенностей коммуникации.',
      'Рекомендации по визуальному оформлению аккаунта.',
      'Формирование стратегии привлечения и удержания аудитории.',
    ]],
    ['3. Контент-планирование', [
      'Разработка ежемесячного контент-плана.',
      'Подбор актуальных тем для публикаций.',
      'Генерация идей для Reels, Stories и постов.',
      'Подготовка сценариев видеороликов.',
      'Разработка продающего, экспертного и личного контента.',
      'Рекомендации по раскрытию экспертности через публикации.',
    ]],
    ['4. Консультационная поддержка', [
      'Регулярная обратная связь по контенту.',
      'Разбор опубликованных материалов.',
      'Рекомендации по улучшению подачи и качества контента.',
      'Помощь в решении текущих SMM-задач.',
      'Консультации по форматам и алгоритмам социальных сетей.',
      'Корректировка стратегии с учётом динамики развития блога.',
    ]],
    ['5. Сопровождение в процессе развития', [
      'Помощь в поиске новых тем и форматов.',
      'Рекомендации по съёмке и монтажу Reels.',
      'Помощь в работе с вовлекающим и продающим контентом.',
      'Анализ реакции аудитории.',
      'Адаптация контентного направления под меняющиеся задачи личного бренда.',
    ]],
  ];
  for (const [index, [, , group]] of groups.entries()) {
    const summary = group.match(/<summary>([\s\S]*?)<\/summary>/)?.[1];
    assert.ok(summary);
    assert.equal(text(summary), expectedGroups[index][0]);
    assert.deepEqual([...group.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, content]) => text(content)), expectedGroups[index][1]);
  }
  const format = section.match(/<div class="personal__format-copy">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(format);
  assert.deepEqual([...format.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, content]) => text(content)), [
    'Вы самостоятельно управляете аккаунтом и публикуете контент. Я обеспечиваю стратегическое сопровождение, помогаю с планированием, идеями и всеми возникающими вопросами по продвижению.',
    'Без передачи доступа к вашему аккаунту и без необходимости полностью делегировать ведение социальных сетей.',
  ]);
  const rate = section.match(/<p class="personal__rate">([\s\S]*?)<\/p>/)?.[1];
  const offer = section.match(/<div class="personal__offer">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(rate && offer);
  assert.equal(text(rate), '35 000 ₽ в месяц');
  assert.match(text(offer), /Стоимость ежемесячного сопровождения\s+35 000 ₽/);
  assert.match(offer, /href="https:\/\/t\.me\/lizzieamo"/);
});

test('the SMM value section keeps the supplied benefits and the specialist’s approach', () => {
  const section = html.match(/<section\b[^>]*id="why-smm"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, 'SMM value section is missing');
  assert.ok(html.indexOf('id="personal-brand"') < html.indexOf('id="why-smm"'));
  assert.ok(html.indexOf('id="why-smm"') < html.indexOf('id="contact"'));
  assert.match(section, /aria-labelledby="why-title"/);
  assert.match(section, /<span>06<\/span>/);
  const text = content => content.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const heading = section.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1];
  const introduction = section.match(/<p class="why__intro-copy">([\s\S]*?)<\/p>/)?.[1];
  assert.ok(heading && introduction);
  assert.equal(text(heading), 'Хороший SMM — это инвестиция в развитие бизнеса.');
  assert.equal(text(introduction), 'Социальные сети давно перестали быть просто площадкой для публикации фотографий и новостей. Сегодня это полноценный инструмент маркетинга, который помогает бизнесу находить новых клиентов, формировать доверие к бренду и увеличивать узнаваемость.');
  assert.deepEqual([...section.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(([, content]) => text(content)), [
    'Почему стоит доверить продвижение мне?',
  ]);
  for (const removed of ['SMM-продвижение помогает', 'Увеличивать узнаваемость бренда', 'Создавать сильный личный бренд']) {
    assert.ok(!section.includes(removed), `The benefits block stays retired: ${removed}`);
  }
  const lists = [...section.matchAll(/<ul class="why__list(?: why__list--approach)?" role="list">([\s\S]*?)<\/ul>/g)];
  assert.equal(lists.length, 1);
  const items = list => [...list.matchAll(/<li class="why__item">([\s\S]*?)<\/li>/g)].map(([, item]) => {
    const title = item.match(/<h4>([\s\S]*?)<\/h4>/)?.[1];
    const description = item.match(/<p>([\s\S]*?)<\/p>/)?.[1];
    assert.ok(title && description, 'Each point needs a title and explanation');
    return [text(title), text(description)];
  });
  assert.deepEqual(items(lists[0][1]), [
    ['7 лет опыта в SMM и digital-маркетинге', 'Работаю с социальными сетями с 2019 года, знаю особенности разных ниш и понимаю, как меняются инструменты продвижения.'],
    ['Стратегический подход', 'Не работаю по принципу публикаций ради публикаций. Каждый контент-план строится на целях проекта, особенностях продукта и потребностях целевой аудитории.'],
    ['Опыт на разных рынках', 'Работала с российскими и зарубежными проектами, в digital-агентствах, самостоятельно и в собственной команде.'],
    ['Комплексный подход к контенту', 'Объединяю маркетинговую стратегию, создание идей, сценарии, съёмку, монтаж и аналитику. Понимаю не только, что нужно опубликовать, но и зачем это нужно бизнесу.'],
    ['Работа с цифрами и результатами', 'Отслеживаю показатели, анализирую эффективность контента и корректирую стратегию на основе данных, а не предположений.'],
    ['Индивидуальный подход', 'Не использую универсальные решения для всех проектов. У каждого бизнеса и личного бренда свои задачи, аудитория и особенности, поэтому стратегия разрабатывается индивидуально.'],
  ]);
  assert.doesNotMatch(section, /<details\b|\shidden(?:\s|>)/, 'Explanations should be visible without extra interaction');
});

test('contact section uses the supplied text and real contact links', () => {
  const section = html.match(/<section\b[^>]*id="contact"[\s\S]*?<\/section>/)?.[0];
  assert.ok(section, 'Contact section is missing');
  assert.match(section, /aria-labelledby="contact-title"/);
  assert.match(section, /<span>07<\/span>/);
  const text = content => content.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ').trim();
  const heading = section.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)?.[1];
  assert.ok(heading);
  assert.equal(text(heading), 'Давайте обсудим ваш проект.');
  assert.deepEqual([...section.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, content]) => text(content)), [
    'Ищете SMM-специалиста для развития бизнеса или личного бренда?',
    'Расскажите о своей задаче, и мы обсудим подходящий формат сотрудничества.',
    'Открыта к новым проектам и интересным задачам.',
  ]);
  assert.match(section, /<h3>Связаться со мной:<\/h3>/);
  const channels = section.match(/<dl class="contact__channels">([\s\S]*?)<\/dl>/)?.[1];
  assert.ok(channels);
  assert.deepEqual([...channels.matchAll(/<dt>([\s\S]*?)<\/dt>\s*<dd><a href="([^"]+)">([\s\S]*?)<\/a><\/dd>/g)]
    .map(([, name, href, value]) => [text(name), href, text(value)]), [
    ['Telegram', 'https://t.me/lizzieamo', '@lizzieamo'],
    ['WhatsApp', 'https://wa.me/79697007993', '+7 (969) 700-79-93'],
    ['Телефон', 'tel:+79697007993', '+7 (969) 700-79-93'],
    ['Почта', 'mailto:unicorn.lyyy@gmail.com', 'unicorn.lyyy@gmail.com'],
  ]);
  assert.match(section, /<a class="button contact__cta" href="https:\/\/t\.me\/lizzieamo" aria-label="Обсудить проект в Telegram">ОБСУДИТЬ ПРОЕКТ<\/a>/);
  assert.doesNotMatch(section, /contact-pending|\bdisabled\b|будет добавлен/i);
  assert.match(css, /\.contact__channels a\s*\{[^}]*min-height:\s*44px/);
  assert.match(css, /\.contact__channels a\s*\{[^}]*text-decoration:\s*underline/);
  assert.match(css, /\.contact__cta\s*\{[^}]*background:\s*var\(--wine\)/);
  assert.equal((section.match(/class="contact__icon"/g) || []).length, 4, 'Every channel carries a line icon');
  assert.match(css, /\.contact__icon\s*\{[^}]*background:\s*var\(--wine\)/, 'The icons sit in wine badges');
  assert.match(css, /\.contact__icon svg\s*\{[^}]*stroke:\s*currentColor/, 'The icons are stroked, not filled');
  assert.doesNotMatch(css, /\.personal__rate strong\s*\{[^}]*font-size/, 'The rate line keeps one even size');
  assert.match(html, /footer__nav/, 'The footer carries its own navigation');
  const footerBrand = html.match(/<a class="footer__brand"[\s\S]*?<\/a>/)?.[0] || '';
  assert.match(footerBrand, /brand__monogram/, 'The footer opens with the logo monogram');
  assert.match(footerBrand, /brand__name/, 'The footer logo repeats the name');
  assert.match(footerBrand, /ЕЛИЗАВЕТА<br>КРАВЕЦ/, 'The footer name keeps the two-line lockup');
  assert.doesNotMatch(footerBrand, /✳/, 'The plain text asterisk is gone from the footer');
  assert.equal((html.match(/<nav class="footer__nav"[^>]*>[\s\S]*?<\/nav>/) || [''])[0].match(/<a /g)?.length, 4, 'Footer links mirror the four sections');
  assert.match(html, /© 2026 Елизавета Кравец/, 'The footer states the authorship');
  assert.match(html, /footer__meta[\s\S]*?https:\/\/t\.me\/lizzieamo/, 'The footer repeats the Telegram contact');
  assert.match(css, /\.footer\s*\{[^}]*border-top:\s*1px solid var\(--line-on-wine\)/, 'A hairline separates the footer band');
  assert.match(css, /\.footer::before\s*\{[^}]*radial-gradient\(/, 'A soft sheen lights the footer');
  assert.match(css, /\.footer__nav a\s*\{[^}]*min-height:\s*44px/, 'Footer links rest in comfortable glass chips');
  assert.match(css, /\.footer__top\s*\{[^}]*border-radius:\s*999px/, 'Back-to-top becomes a glass button');
});

test('every collaboration call to action goes directly to the supplied Telegram', () => {
  const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(([, , content]) => /Обсудить сотрудничество/.test(content));
  assert.equal(links.length, 3);
  for (const [, attrs] of links) {
    assert.match(attrs, /href="https:\/\/t\.me\/lizzieamo"/);
    assert.match(attrs, /aria-label="Обсудить сотрудничество в Telegram"/);
  }
});

test('hero uses a high-resolution cloche image and more moving, decorative petals', () => {
  assert.match(html, /assets\/rose-cloche\.webp/);
  assert.match(html, /assets\/rose-cloche\.jpg/);
  assert.ok(existsSync('assets/rose-cloche.webp'));
  assert.ok(existsSync('assets/rose-cloche.jpg'));
  for (const asset of ['new', 'compact', 'floating', 'tabletop', 'resting']) {
    assert.ok(existsSync(`assets/rose-petal-${asset}.png`), `Missing ${asset} petal asset`);
  }
  assert.ok((html.match(/class="petal petal--/g) || []).length >= 6);
  assert.ok((html.match(/class="ground-petal ground-petal--/g) || []).length >= 9, 'The floor carries a generous scatter of resting petals');
  assert.match(css, /@media\s*\(min-width:\s*900px\)\s*\{[\s\S]*?\.ground-petal--eight\s*\{[^}]*display:\s*block/, 'Extra resting petals appear on desktop');
  assert.match(css, /@media\s*\(min-width:\s*900px\)\s*\{[\s\S]*?\.ground-petal--eleven\s*\{[^}]*display:\s*block/, 'The desktop floor ends with the eleventh petal');
  assert.match(css, /\.ground-petal--eight,\s*\.ground-petal--nine,\s*\.ground-petal--ten,\s*\.ground-petal--eleven\s*\{[^}]*display:\s*none/, 'The extra petals stay hidden below desktop');
  assert.match(html, /class="hero__petals" aria-hidden="true"/);
  assert.match(html, /class="hero__ground" aria-hidden="true"/);
  assert.match(css, /\.hero__image,\s*\.hero__petals\s*\{[^}]*aspect-ratio:\s*2\s*\/\s*3/);
  assert.match(css, /\.petal\s*\{[^}]*width:\s*var\(--size\)/);
  assert.match(css, /\.petal\s*\{[^}]*height:\s*var\(--size\)/);
  assert.match(css, /\.petal\s*\{[^}]*background-size:\s*contain/);
  assert.match(css, /@keyframes petal-drift/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('petals preserve their aspect ratio during movement', () => {
  const petals = [...html.matchAll(/<span\s+class="petal\s+petal--[^>]+>/g)].map(match => match[0]);
  assert.ok(petals.length >= 6);
  for (const petal of petals) {
    assert.match(petal, /petal--(?:broad|round|floating)/, 'Each petal needs an undistorted background');
  }
  for (const src of ['assets/rose-petal-new.png', 'assets/rose-petal-compact.png', 'assets/rose-petal-floating.png', 'assets/rose-petal-tabletop.png', 'assets/rose-petal-resting.png']) {
    assert.ok(css.includes(`url("${src}")`), `${src} should be used as a background`);
    const png = readFileSync(src);
    assert.equal(png.toString('ascii', 1, 4), 'PNG');
    assert.equal(png[25], 6, `${src} should have an alpha channel`);
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    assert.ok(width / height >= 0.65 && width / height <= 1.8, `${src} should not be elongated`);
  }
  const start = css.indexOf('@keyframes petal-drift');
  assert.ok(start >= 0, 'Missing petal animation');
  const open = css.indexOf('{', start);
  assert.ok(open > start, 'Missing animation block');
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) { end = i; break; }
  }
  assert.ok(end > open, 'Animation block must not be empty');
  const keyframes = css.slice(open + 1, end);
  assert.match(keyframes, /0%\s*\{/);
  assert.match(keyframes, /100%\s*\{/);
  assert.match(keyframes, /translate3d\s*\(/);
  assert.match(keyframes, /rotate\s*\(/);
  assert.doesNotMatch(keyframes, /scale(?:X|Y|3d)?\s*\(/i, 'Motion must not scale petals');
});

test('flying petals remain large and staggered on tablet and desktop', () => {
  const unitSizes = [...css.matchAll(/--petal-unit:\s*clamp\((\d+)px,\s*[^,]+,\s*(\d+)px\)/g)];
  assert.equal(unitSizes.length, 2, 'Tablet and desktop need responsive petal sizes');
  assert.ok(Number(unitSizes[0][1]) >= 44, 'Tablet petals should not return to their old tiny size');
  assert.ok(Number(unitSizes[1][1]) >= 68, 'Desktop petals should not return to their old tiny size');

  const position = (block, name) => {
    const rule = block.match(new RegExp(`\\.petal--${name}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `Missing position: ${name}`);
    const left = rule[1].match(/left:\s*(\d+)%/);
    const top = rule[1].match(/top:\s*(\d+)%/);
    assert.ok(left && top, `Incomplete position: ${name}`);
    return { left: Number(left[1]), top: Number(top[1]) };
  };
  const mobile = css.slice(css.indexOf('.petal--one'), css.indexOf('@keyframes petal-drift'));
  const mobilePetals = ['eight', 'one', 'two', 'six', 'five', 'four'].map(name => position(mobile, name));
  assert.ok(mobilePetals.every(petal => petal.left >= 65 && petal.left <= 85), 'Keep mobile petals within the frame');
  assert.ok(Math.max(...mobilePetals.map(p => p.left)) - Math.min(...mobilePetals.map(p => p.left)) >= 10,
    'Avoid a rigid column of petals');
  assert.ok(mobilePetals.every((petal, i) => i === 0 || petal.top > mobilePetals[i - 1].top),
    'Space flying petals at different heights');

  const desktop = css.slice(css.indexOf('@media (min-width: 900px) {'), css.indexOf('@media (prefers-reduced-motion: reduce)'));
  const upperLeft = position(desktop, 'one');
  const middleLeft = position(desktop, 'two');
  const right = position(desktop, 'four');
  const lowerRight = position(desktop, 'five');
  assert.ok(upperLeft.left < 50 && middleLeft.left < 50 && upperLeft.top < middleLeft.top);
  assert.ok(right.left >= 85 && right.left <= 93 && lowerRight.left >= 85 && lowerRight.left <= 93);
  assert.ok(right.top < lowerRight.top, 'Keep the right petals at different heights');
});

test('ground petals stay still and span the hero without stretching', () => {
  const groundPetals = [...html.matchAll(/<span\s+class="ground-petal\s+ground-petal--[^>]+>/g)];
  assert.equal(groundPetals.length, 11, 'Seven base petals plus four desktop-only ones');
  const rule = css.match(/\.ground-petal\s*\{([^}]*)\}/);
  assert.ok(rule, 'Ground petal rule is missing');
  assert.match(rule[1], /width:\s*var\(--size\)/);
  assert.match(rule[1], /height:\s*var\(--size\)/);
  assert.match(rule[1], /transform:\s*rotate\(/);
  assert.doesNotMatch(rule[1], /animation|scale\s*\(/i, 'Ground petals should stay still and retain their proportions');
  assert.match(css, /\.ground-petal::after\s*\{[^}]*background-size:\s*contain/);
  assert.match(css, /\.ground-petal::before\s*\{[^}]*filter:\s*blur\(/);
  assert.match(css, /\.hero__ground\s*\{[^}]*--ground-unit:\s*clamp\(58px,\s*16\.5vw,\s*82px\)/, 'Ground petals grow a touch');
  assert.match(css, /--ground-unit:\s*clamp\(78px,\s*9vh,\s*116px\)/, 'Ground petals keep pace on tall desktop screens');

  const mobilePositions = ['one', 'two', 'three', 'four', 'five'].map((name) => {
    const entry = css.match(new RegExp(`\\.ground-petal--${name}\\s*\\{([^}]*)\\}`));
    assert.ok(entry, `Missing ground petal ${name}`);
    const left = entry[1].match(/left:\s*(-?\d+)%/);
    const bottom = entry[1].match(/bottom:\s*(\d+)px/);
    assert.ok(left && bottom, `Incomplete ground petal position: ${name}`);
    assert.ok(Number(bottom[1]) >= 50, 'Keep ground petals clear of the section edge');
    return Number(left[1]);
  });
  assert.ok(Math.min(...mobilePositions) <= 2 && Math.max(...mobilePositions) >= 80,
    'Ground petals should reach both sides of the hero');
});

test('Onest and the accent font are self-hosted with Cyrillic and browser fallbacks', () => {
  assert.match(css, /@font-face/);
  for (const subset of ['cyrillic', 'latin']) {
    const fonts = [400, 600, 700].map(weight => `onest-${subset}-${weight}-normal`);
    fonts.push(`cormorant-garamond-${subset}-600-italic`);
    for (const font of fonts) {
      for (const extension of ['woff2', 'woff']) {
        assert.ok(css.includes(`url("assets/fonts/${font}.${extension}")`), `${font}.${extension} must be declared`);
        assert.ok(existsSync(`assets/fonts/${font}.${extension}`), `${font}.${extension} must be present`);
      }
    }
  }
  assert.ok(existsSync('assets/fonts/ONEST-OFL.txt'));
  assert.ok(existsSync('assets/fonts/CORMORANT-GARAMOND-OFL.txt'));
  assert.match(css, /Onest/);
  assert.match(css, /Cormorant Garamond/);
  assert.match(css, /sans-serif/);
  assert.match(css, /serif/);
  assert.doesNotMatch(css, /assets\/fonts\/(?:manrope|playfair-display|inter)-/i);
});

test('the palette uses the hero burgundy and the reference blue consistently', () => {
  assert.match(css, /--wine:\s*#650e27\b/i);
  assert.match(css, /--ice:\s*#c7e5ff\b/i);
  assert.match(css, /\.hero\s*\{[^}]*background:\s*var\(--wine\)/);
  assert.match(css, /\.section--wine\s*\{[^}]*background:\s*var\(--wine\)/);
  assert.match(css, /\.footer\s*\{[^}]*background:\s*var\(--wine\)/);
  assert.match(html, /<section\s+class="about section section--wine"/);
  assert.match(css, /\.hero__ground::before\s*\{[^}]*linear-gradient\(to top,\s*transparent\s+0%/,
    'The hero floor shadow must fade out at the boundary with the about section');
  assert.match(html, /name="theme-color"\s+content="#650e27"/i);
  assert.match(read('assets/favicon.svg'), /fill="#650e27"/i);
  assert.doesNotMatch(css, /#(?:7a102d|74102c|650d27|e4f3ff)\b/i);
});

test('light-blue surfaces use stronger, readable burgundy text', () => {
  const ink = css.match(/--ink-on-ice:\s*(#[\da-f]{6})\b/i)?.[1];
  const ice = css.match(/--ice:\s*(#[\da-f]{6})\b/i)?.[1];
  const wine = css.match(/--wine:\s*(#[\da-f]{6})\b/i)?.[1];
  assert.ok(ink && ice && wine, 'Missing palette tokens');
  const luminance = hex => {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const contrast = (a, b) => {
    const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (light + 0.05) / (dark + 0.05);
  };
  assert.ok(contrast(ink, ice) >= 12, 'Blue-surface text should have strong contrast');
  assert.ok(contrast(ink, ice) > contrast(wine, ice), 'Reading ink should be darker than the hero burgundy');
  const rule = selector => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `Missing rule: ${selector}`);
    return match[1];
  };
  for (const selector of ['.section--ice', '.project-card--light', '.services__extra']) {
    assert.match(rule(selector), /color:\s*var\(--ink-on-ice\)/);
    assert.match(rule(selector), /font-weight:\s*600/);
  }
  assert.match(rule('.button--ice'), /color:\s*var\(--ink-on-ice\)/);
  for (const selector of ['.metric--feature', '.personal__format']) {
    assert.match(rule(selector), /background:\s*var\(--wine\)/);
    assert.match(rule(selector), /color:\s*var\(--text-on-wine\)/);
    assert.match(rule(selector), /font-weight:\s*400/);
  }
  const textOnWine = css.match(/--text-on-wine:\s*(#[\da-f]{6})\b/i)?.[1];
  assert.ok(textOnWine, 'Missing the wine-surface ink token');
  assert.ok(contrast(textOnWine, wine) >= 8.5, 'Wine-surface text should stay crisp');
  assert.ok(contrast(textOnWine, wine) > contrast(ice, wine), 'The wine ink reads brighter than the pastel ice');
  assert.doesNotMatch(rule('.evidence__hint'), /opacity:\s*(?:0?\.\d+)/, 'The hint must not fade text');
  assert.match(rule('.project-card--light .project-card__details dd'), /opacity:\s*1/);
  assert.match(rule('.evidence__hint'), /font-size:\s*18px/);
});

test('project cards open one at a time and glide', () => {
  const js = read('script.js');
  assert.doesNotMatch(html, /Показатель уточняется/, 'The pending captions are retired');
  assert.doesNotMatch(html, /metric__pending/);
  assert.doesNotMatch(css, /\.metric__pending/);
  assert.match(js, /querySelector\('\.project-list'\)/, 'The cards learn accordion manners');
  assert.match(js, /other !== card && other\.open/, 'Opening one card folds the other');
  assert.match(js, /if \(closing\) card\.open = false/, 'The glide ends by really closing the card');
  assert.match(js, /prefers-reduced-motion/, 'The glide respects reduced motion');
  assert.match(css, /@media\s*\(hover:\s*hover\)\s*\{[\s\S]*?\.project-card:hover\s*\{[^}]*translateY\(-3px\)/, 'Cards lift on hover');
  assert.match(css, /\.project-card__toggle\s*\{[^}]*linear-gradient\(/, 'The plus button sits on glass');
  assert.doesNotMatch(css, /\n\s*\.project-card__details dd\s*\{[^}]*opacity/, 'The case values read at full strength');
});

test('phones read lighter and scroll less', () => {
  const phone = [...css.matchAll(/@media\s*\(max-width:\s*599px\)\s*\{([\s\S]*?)\n\}/g)]
    .map(([, body]) => body)
    .find((body) => /body\s*\{/.test(body));
  assert.ok(phone, 'The compact phone styles are missing');
  assert.match(phone, /body\s*\{[^}]*font-size:\s*18px/, 'Phone body text steps down');
  assert.match(phone, /\.about__copy\s*\{[^}]*font-size:\s*19px/, 'The about paragraphs shrink together on phones');
  assert.match(phone, /\.about__copy\s*\{[^}]*gap:\s*16px/, 'Phone text keeps its original rhythm');
  assert.match(phone, /\.about__extra\s*\{[^}]*display:\s*none/, 'The two extra paragraphs stay off phones');
  assert.match(phone, /\.contact__copy\s*\{[^}]*font-size:\s*18px/);
  assert.doesNotMatch(phone, /hero__description|hero__role/, 'The hero keeps its sizes');
  assert.match(phone, /\.section\s*\{[^}]*padding-block:\s*62px/, 'Sections breathe tighter');
  assert.match(phone, /main\s*\{[^}]*--vine-space:\s*116px/, 'The hedge reserves less room');
  assert.match(css, /\.site-menu-toggle\s*\{[^}]*width:\s*60px/, 'The burger button grows');
  assert.match(phone, /\.footer__inner\s*\{[^}]*flex-direction:\s*column/, 'The phone footer stacks in a column');
  assert.match(phone, /\.footer__main\s*\{[^}]*align-self:\s*center/, 'The footer logo block sits in the middle');
  assert.match(phone, /\.footer__top\s*\{[^}]*align-self:\s*center/, 'The back-to-top button centres too');
  assert.match(phone, /\.tariff-card\s*\{[^}]*padding:\s*18px/, 'Tariff cards tighten up on phones');
  assert.match(phone, /\.tariff-card__price\s*\{[^}]*font-size:\s*28px/, 'The tariff price shrinks on phones');
  assert.match(phone, /\.contact__channels > div\s*\{[^}]*flex-direction:\s*column/, 'Channel cards stack their lines on phones');
  assert.match(phone, /\.contact__channels dd\s*\{[^}]*margin:\s*0 0 0 59px/, 'The value lines up under the channel name');
  assert.match(css, /\.site-menu-toggle__icon\s*\{[^}]*width:\s*34px/, 'The three bars grow with it');
  assert.match(phone, /\.evidence-card:nth-child\(-n\+3\)\s*\{[^}]*flex-basis:\s*max\(96%,\s*260px\)/, 'The first three landscape screens read larger');
});

test('a lush flowering hedge softens section boundaries without covering the hero/about transition', () => {
  const sections = [...html.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map(([, id]) => id);
  assert.deepEqual(sections, ['top', 'about', 'results', 'projects', 'services', 'personal-brand', 'why-smm', 'contact']);
  const decoration = css.match(/main\s*>\s*\.section:not\(\.about\)::before\s*\{([^}]*)\}/)?.[1];
  assert.ok(decoration, 'The decorative transition is missing');
  assert.match(decoration, /background-repeat:\s*repeat-x/);
  assert.match(decoration, /background-size:\s*auto\s+100%/, 'Do not stretch the foliage');
  assert.match(decoration, /pointer-events:\s*none/, 'Decoration must not block controls');
  assert.match(decoration, /top:\s*calc\(var\(--vine-height\)\s*\/\s*-2\)/);
  assert.match(decoration, /url\("assets\/rose-hedge\.png"\)/);
  assert.match(decoration, /url\("assets\/rose-hedge\.webp"\)/);
  const sectionRule = css.match(/main\s*>\s*\.section:not\(\.about\)\s*\{([^}]*)\}/)?.[1];
  assert.ok(sectionRule);
  assert.match(sectionRule, /scroll-margin-top/);
  assert.match(sectionRule, /padding-top:\s*var\(--vine-space\)/);
  assert.ok(Number(sectionRule.match(/--vine-height:\s*(\d+)px/)?.[1]) >= 180, 'Make room for a lush mobile hedge');
  assert.match(css, /main\s*>\s*\.section:not\(\.contact\)\s*\{[^}]*padding-bottom:\s*var\(--vine-space\)/);
  assert.ok(existsSync('assets/rose-hedge.webp'));
  const png = readFileSync('assets/rose-hedge.png');
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.equal(png[25], 6, 'Hedge fallback should have a transparent alpha channel');
  assert.ok(png.readUInt32BE(16) / png.readUInt32BE(20) > 3, 'Hedge should be a wide, natural-proportion strip');
});

test('the hedge has transparent edges and dense foliage across its centre', () => {
  const png = readFileSync('assets/rose-hedge.png');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(png[24], 8, 'The PNG decoder below expects 8-bit channels');
  assert.equal(png[25], 6, 'The PNG decoder below expects RGBA');
  assert.equal(png[28], 0, 'The PNG decoder below expects a non-interlaced image');
  const chunks = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
    if (type === 'IEND') break;
  }
  const data = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  assert.equal(data.length, (stride + 1) * height);
  let previous = new Uint8Array(width), first, centre, last;
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1), filter = data[start];
    const row = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      const left = x ? row[x - 1] : 0, up = previous[x], upperLeft = x ? previous[x - 1] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const base = left + up - upperLeft;
        const a = Math.abs(base - left), b = Math.abs(base - up), c = Math.abs(base - upperLeft);
        predictor = a <= b && a <= c ? left : b <= c ? up : upperLeft;
      } else assert.equal(filter, 0, 'Unknown PNG filter');
      row[x] = (data[start + 1 + x * 4 + 3] + predictor) & 255;
    }
    if (y === 0) first = row;
    if (y === Math.floor(height / 2)) centre = row;
    if (y === height - 1) last = row;
    previous = row;
  }
  assert.deepEqual([first[0], first[width - 1], last[0], last[width - 1]], [0, 0, 0, 0], 'Outside the foliage must remain transparent');
  assert.ok(centre.filter(alpha => alpha > 240).length / width > .98, 'The foliage should hide almost all of the section seam');
});

test('main mobile reading text is at least 20px', () => {
  for (const selector of [
    '.hero__role', '.hero__description', '.section-heading__copy', '.about__copy',
    '.metric__caption', '.project-card__description', '.project-card__details',
    '.tariff-card__name', '.tariff-card__details', '.tariff-card__description',
    '.services__extra-copy', '.services__related', '.personal__intro', '.personal-feature__content',
    '.personal__format-copy', '.personal__offer', '.why__intro-copy', '.why__item h4',
    '.why__item p', '.contact__copy',
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(rule, `Missing rule: ${selector}`);
    const size = rule[1].match(/font-size:\s*(\d+)px/);
    assert.ok(size && Number(size[1]) >= 20, `${selector} should use at least 20px`);
  }
});

test('all local images and fonts referenced by the page exist', () => {
  const htmlAssets = [...html.matchAll(/(?:src|srcset|href)=["'](assets\/[^"']+)["']/g)].map(match => match[1]);
  const cssAssets = [...css.matchAll(/url\(["']?(assets\/[^"')]+)["']?\)/g)].map(match => match[1]);
  assert.ok(htmlAssets.length > 0 && cssAssets.length > 0);
  for (const asset of [...htmlAssets, ...cssAssets]) {
    assert.ok(existsSync(asset), `Missing local asset: ${asset}`);
  }
});

test('a playful Instagram-style fan toast follows the cooperation buttons', () => {
  const js = read('script.js');
  const toastHtml = html.slice(html.indexOf('class="follow-toast"'), html.indexOf('</body>'));
  assert.match(html, /<div class="follow-toast" aria-hidden="true">/, 'The decorative toast exists and stays silent for screen readers');
  assert.equal((toastHtml.match(/class="follow-toast__stat"/g) || []).length, 3, 'Three icon-and-count stats ride the red banner');
  assert.equal((toastHtml.match(/<svg viewBox="0 0 24 24">/g) || []).length, 3, 'Heart, comments, and followers icons ride the banner');
  assert.equal((toastHtml.match(/follow-toast__count/g) || []).length, 3, 'Three counts ride the banner');
  assert.doesNotMatch(toastHtml, /[а-яё]/i, 'The banner speaks in icons and numbers, like the reference');
  assert.match(css, /\.follow-toast\s*\{[^}]*position:\s*fixed/, 'The toast lives in a corner');
  assert.match(css, /\.follow-toast\s*\{[^}]*background:\s*#fe2b54/, 'The toast wears the bright red banner');
  assert.match(css, /\.follow-toast::after\s*\{[^}]*clip-path:\s*polygon\(/, 'The banner points down with a little tail');
  assert.match(css, /\.follow-toast__count\s*\{[^}]*font-variant-numeric:\s*tabular-nums/, 'The counts hold steady widths while they change');
  assert.match(css, /@media\s*\(hover:\s*none\)\s*\{[^}]*\.follow-toast\s*\{[^}]*display:\s*none/, 'Touch screens never see the toast');
  assert.match(js, /querySelector\('\.follow-toast'\)/, 'The script finds the toast early and bails without it');
  assert.match(js, /GROW_MS = 5000/, 'The counts climb for five seconds');
  assert.match(js, /FALL_MS = 5000/, 'The counts fall for five seconds before the plaque departs');
  assert.match(js, /mouseenter/);
  assert.match(js, /mouseleave/);
});
