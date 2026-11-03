import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync('script.js', 'utf8');
const css = readFileSync('styles.css', 'utf8');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      const callbacks = listeners.get(type) || new Set();
      callbacks.add(callback);
      listeners.set(type, callbacks);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatch(type, event = {}) {
      for (const callback of [...(listeners.get(type) || [])]) callback(event);
    },
  };
}

function revealElement(top) {
  const classes = new Set();
  return {
    getBoundingClientRect: () => ({ top, bottom: top + 100 }),
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    closest() { return classes.has('scroll-reveal-pending') || classes.has('scroll-reveal-enter') ? this : null; },
  };
}

function setup({ reduced = false, observerSupported = true, mediaSupported = true } = {}) {
  const above = revealElement(-300);
  const visible = revealElement(100);
  const below = revealElement(900);
  const later = revealElement(1500);
  const targets = [above, visible, below, later];
  const document = eventTarget();
  document.querySelector = () => null;
  let selector = '';
  document.querySelectorAll = value => { selector = value; return targets; };
  const motion = eventTarget();
  motion.matches = !reduced;
  const window = { innerHeight: 800 };
  if (mediaSupported) window.matchMedia = () => motion;
  let observer;
  if (observerSupported) window.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = new Set();
      this.disconnected = false;
      observer = this;
    }
    observe(element) { this.observed.add(element); }
    unobserve(element) { this.observed.delete(element); }
    disconnect() { this.disconnected = true; this.observed.clear(); }
    dispatch(entries) { this.callback(entries); }
  };
  runInNewContext(script, { window, document });
  return { above, visible, below, later, document, motion, observer, selector };
}

const pending = el => el.classList.contains('scroll-reveal-pending');
const entering = el => el.classList.contains('scroll-reveal-enter');

test('scroll reveal keeps the initial viewport visible and observes only later content', () => {
  const { above, visible, below, later, observer, selector } = setup();
  assert.equal(pending(above), false);
  assert.equal(pending(visible), false);
  assert.equal(pending(below), true);
  assert.equal(pending(later), true);
  assert.deepEqual([...observer.observed], [below, later]);
  assert.equal(observer.options.rootMargin, '0px 0px -24px 0px');
  assert.equal(observer.options.threshold, 0);
  for (const part of ['.about__copy > p', '.metrics > .metric', '.project-list > .project-card', '.tariffs > .tariff-card', '.personal__features > .personal-feature', '.why__list > .why__item', '.contact__cta']) {
    assert.ok(selector.includes(part), `Missing reveal group ${part}`);
  }
});

test('visible elements animate once, then discard their animation class', () => {
  const { below, document, observer } = setup();
  observer.dispatch([{ target: below, isIntersecting: true, boundingClientRect: { bottom: 600 } }]);
  assert.equal(pending(below), false);
  assert.equal(entering(below), true);
  assert.equal(observer.observed.has(below), false);
  document.dispatch('animationend', { target: below, animationName: 'scroll-reveal-rise' });
  assert.equal(entering(below), false);
  observer.dispatch([{ target: below, isIntersecting: true, boundingClientRect: { bottom: 600 } }]);
  assert.equal(entering(below), false, 'An already revealed element should not animate again');
});

test('a fast jump past unseen content makes it visible instead of stranding it', () => {
  const { below, observer } = setup();
  observer.dispatch([{ target: below, isIntersecting: false, boundingClientRect: { bottom: -1 } }]);
  assert.equal(pending(below), false);
  assert.equal(entering(below), false);
  assert.equal(observer.observed.has(below), false);
});

test('keyboard focus makes pending or animating content visible immediately', () => {
  const { below, later, document, observer } = setup();
  const focus = target => document.dispatch('focusin', { target: { closest: () => target } });
  focus(below);
  assert.equal(pending(below), false);
  assert.equal(observer.observed.has(below), false);
  observer.dispatch([{ target: later, isIntersecting: true, boundingClientRect: { bottom: 500 } }]);
  assert.equal(entering(later), true);
  focus(later);
  assert.equal(entering(later), false);
});

test('reduced motion and missing browser APIs never hide content', () => {
  for (const options of [{ reduced: true }, { observerSupported: false }, { mediaSupported: false }]) {
    const { below, later, observer } = setup(options);
    assert.equal(observer, undefined);
    assert.equal(pending(below), false);
    assert.equal(pending(later), false);
  }
});

test('changing to reduced motion releases all pending and animated content', () => {
  const { below, later, motion, observer } = setup();
  observer.dispatch([{ target: below, isIntersecting: true, boundingClientRect: { bottom: 500 } }]);
  motion.matches = false;
  motion.dispatch('change', { matches: false });
  assert.equal(observer.disconnected, true);
  assert.equal(pending(later), false);
  assert.equal(entering(below), false);
});

test('reveal styling is motion-aware and keeps focused content visible', () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*no-preference\)[\s\S]*?\.scroll-reveal-pending\s*\{[^}]*opacity:\s*0/);
  assert.match(css, /\.scroll-reveal-enter\s*\{[^}]*animation:\s*scroll-reveal-rise/);
  assert.match(css, /\.scroll-reveal-pending:focus-within[^}]*opacity:\s*1\s*!important/);
  assert.match(css, /@keyframes\s+scroll-reveal-rise[\s\S]*?opacity:\s*1/);
  assert.match(css, /@media\s+print\s*\{[\s\S]*?\.scroll-reveal-pending[^}]*opacity:\s*1\s*!important/);
});
