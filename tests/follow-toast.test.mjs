import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync('script.js', 'utf8');

function setup() {
  const classes = new Set();
  const counter = { textContent: '' };
  const label = { textContent: '' };
  const toast = {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    querySelector: (selector) => {
      if (selector === '.follow-toast__count') return counter;
      if (selector === '.follow-toast__label') return label;
      return null;
    },
  };
  const listeners = new Map();
  const button = {
    textContent: 'Обсудить сотрудничество',
    addEventListener(type, listener) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(listener);
      listeners.set(type, callbacks);
    },
    hover() { for (const listener of listeners.get('mouseenter') || []) listener(); },
    leave() { for (const listener of listeners.get('mouseleave') || []) listener(); },
  };
  const intervals = new Map();
  const timeouts = new Map();
  let nextId = 1;
  const window = {
    matchMedia: (query) => ({ matches: query === '(hover: hover)' }),
    setInterval: (callback) => { intervals.set(nextId, callback); return nextId++; },
    clearInterval: (id) => { intervals.delete(id); },
    setTimeout: (callback) => { timeouts.set(nextId, callback); return nextId++; },
    clearTimeout: (id) => { timeouts.delete(id); },
  };
  const document = {
    querySelector: (selector) => (selector === '.follow-toast' ? toast : null),
    querySelectorAll: (selector) => (selector === 'a[href^="https://t.me/"]' ? [button] : []),
  };
  runInNewContext(script, { document, window });
  const fireAll = (map) => {
    const callbacks = [...map.values()];
    map.clear();
    for (const callback of callbacks) callback();
  };
  return {
    button, classes, counter, label, intervals,
    tick: () => fireAll(intervals),
    fireTimeouts: () => fireAll(timeouts),
    value: () => Number(counter.textContent.replace(/\D/g, '')),
  };
}

test('the plaque arrives with a big count and climbs for five seconds', () => {
  const t = setup();
  t.button.hover();
  assert.ok(t.classes.has('is-visible'), 'the plaque shows up at once');
  assert.equal(t.label.textContent, 'подписались на вас');
  const start = t.value();
  assert.ok(start >= 6400 && start <= 13800, 'the count starts big and believable');
  assert.ok(!t.counter.textContent.includes('+'), 'the count is a plain number like the original');

  t.tick();
  t.tick();
  assert.ok(t.value() > start, 'the count climbs while hovering');

  t.fireTimeouts();
  const frozen = t.value();
  t.tick();
  assert.equal(t.value(), frozen, 'the climb stops after five seconds');
});

test('the count falls for five seconds and then the plaque departs', () => {
  const t = setup();
  t.button.hover();
  t.fireTimeouts();
  const peak = t.value();

  t.button.leave();
  assert.equal(t.label.textContent, 'отписываются…');
  t.tick();
  t.tick();
  assert.ok(t.value() < peak, 'the count falls after the cursor leaves');

  t.fireTimeouts();
  assert.ok(!t.classes.has('is-visible'), 'the plaque departs five seconds after the cursor leaves');
});

test('hovering again during the fall resumes the climb immediately', () => {
  const t = setup();
  t.button.hover();
  t.fireTimeouts();
  t.button.leave();
  t.tick();
  const fallen = t.value();
  assert.ok(fallen > 0, 'the count has not drained to zero yet');

  t.button.hover();
  assert.equal(t.label.textContent, 'подписались на вас');
  assert.ok(t.classes.has('is-visible'));
  assert.equal(t.value(), fallen, 'the climb resumes from the current count');

  t.tick();
  assert.ok(t.value() > fallen, 'the count climbs again without waiting');
});

test('a fresh hover after the plaque departs starts a new count', () => {
  const t = setup();
  t.button.hover();
  t.button.leave();
  t.fireTimeouts();
  t.fireTimeouts();
  assert.ok(!t.classes.has('is-visible'));

  t.button.hover();
  assert.ok(t.value() >= 6400, 'a fresh big count arrives');
  assert.ok(t.classes.has('is-visible'));
});
