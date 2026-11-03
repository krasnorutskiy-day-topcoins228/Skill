import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync('script.js', 'utf8');

function element() {
  const classes = new Set();
  const attributes = new Map();
  const listeners = new Map();
  return {
    hidden: false,
    inert: false,
    focusCount: 0,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
    },
    addEventListener(type, listener) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(listener);
      listeners.set(type, callbacks);
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    focus() { this.focusCount++; },
  };
}

function setup({ wide = false, supportsMedia = true } = {}) {
  const header = element();
  const toggle = element();
  const navigation = element();
  const brand = element();
  const document = element();
  const html = element();
  const link = { closest: (selector) => selector === 'a[href]' ? link : null };
  const outside = {};
  toggle.hidden = true;
  toggle.setAttribute('aria-expanded', 'false');
  header.contains = (node) => [header, toggle, navigation, brand, link].includes(node);
  document.documentElement = html;
  document.querySelector = (selector) => ({
    '.site-header': header,
    '.site-menu-toggle': toggle,
    '#primary-navigation': navigation,
    '.site-header .brand': brand,
  })[selector];
  const media = element();
  media.matches = !wide;
  const window = element();
  window.scrollY = 0;
  if (supportsMedia) window.matchMedia = () => media;
  runInNewContext(script, { document, window });
  return { header, toggle, navigation, brand, document, html, link, outside, media, window };
}

test('mobile drawer opens and closes with accessible state and scroll locking', () => {
  const { header, toggle, navigation, html } = setup();
  assert.ok(html.classList.contains('has-menu'));
  assert.equal(toggle.hidden, false);
  assert.equal(navigation.hidden, false, 'Keep the drawer in the layout for its exit animation');
  assert.equal(navigation.inert, true);
  assert.equal(navigation.getAttribute('aria-hidden'), 'true');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-label'), 'Открыть меню');

  navigation.scrollTop = 250;
  toggle.dispatch('click');
  assert.equal(navigation.scrollTop, 0, 'Reopen the menu at its first link');
  assert.equal(navigation.inert, false);
  assert.equal(navigation.getAttribute('aria-hidden'), null);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(toggle.getAttribute('aria-label'), 'Закрыть меню');
  assert.ok(header.classList.contains('is-menu-open'));
  assert.ok(html.classList.contains('menu-is-open'));

  toggle.dispatch('click');
  assert.equal(navigation.inert, true);
  assert.equal(navigation.getAttribute('aria-hidden'), 'true');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(header.classList.contains('is-menu-open'), false);
  assert.equal(html.classList.contains('menu-is-open'), false);
});

test('drawer closes for navigation or contact links, logo, backdrop, focus leaving, and Escape', () => {
  const { header, toggle, navigation, brand, document, link, outside } = setup();
  toggle.dispatch('click');
  navigation.dispatch('click', { target: link });
  assert.equal(navigation.inert, true);

  toggle.dispatch('click');
  brand.dispatch('click');
  assert.equal(navigation.inert, true);

  toggle.dispatch('click');
  document.dispatch('click', { target: header });
  assert.equal(navigation.inert, true);

  toggle.dispatch('click');
  document.dispatch('focusin', { target: outside });
  assert.equal(navigation.inert, true);

  toggle.dispatch('click');
  document.dispatch('keydown', { key: 'Escape' });
  assert.equal(navigation.inert, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.focusCount, 1);
});

test('switching screen sizes resets the drawer and shows desktop links', () => {
  const { header, toggle, navigation, html, media } = setup();
  toggle.dispatch('click');
  media.matches = false;
  media.dispatch('change');
  assert.equal(navigation.hidden, false);
  assert.equal(navigation.inert, false);
  assert.equal(navigation.getAttribute('aria-hidden'), null);
  assert.equal(toggle.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(header.classList.contains('is-menu-open'), false);
  assert.equal(html.classList.contains('menu-is-open'), false);

  media.matches = true;
  media.dispatch('change');
  assert.equal(navigation.inert, true);
  assert.equal(navigation.getAttribute('aria-hidden'), 'true');
  assert.equal(toggle.hidden, false);
});

test('the fixed header fades its border in after scrolling and out again at the top', () => {
  for (const wide of [false, true]) {
    const { header, html, window } = setup({ wide });
    assert.ok(html.classList.contains('has-sticky-header'));
    assert.equal(header.classList.contains('is-scrolled'), false);
    window.scrollY = 5;
    window.dispatch('scroll');
    assert.ok(header.classList.contains('is-scrolled'));
    window.scrollY = 4;
    window.dispatch('scroll');
    assert.equal(header.classList.contains('is-scrolled'), false);
  }
});

test('scroll events update the edge without closing an open menu', () => {
  const { header, toggle, navigation, window } = setup();
  toggle.dispatch('click');
  window.scrollY = 300;
  window.dispatch('scroll');
  assert.ok(header.classList.contains('is-scrolled'));
  assert.ok(header.classList.contains('is-menu-open'));
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(navigation.inert, false);
  window.scrollY = 0;
  window.dispatch('scroll');
  assert.equal(header.classList.contains('is-scrolled'), false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
});

test('navigation stays visible when responsive JavaScript cannot run', () => {
  const { navigation, toggle, html, header, window } = setup({ supportsMedia: false });
  assert.equal(navigation.hidden, false);
  assert.equal(navigation.inert, false);
  assert.equal(navigation.getAttribute('aria-hidden'), null);
  assert.equal(toggle.hidden, true);
  assert.equal(html.classList.contains('has-menu'), false);
  assert.ok(html.classList.contains('has-sticky-header'));
  window.scrollY = 20;
  window.dispatch('scroll');
  assert.ok(header.classList.contains('is-scrolled'));
});
