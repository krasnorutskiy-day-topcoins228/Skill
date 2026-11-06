import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync('script.js', 'utf8');

function setup() {
  const classes = new Set();
  const counters = [{ textContent: '' }, { textContent: '' }, { textContent: '' }];
  const toast = {
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    querySelector: () => null,
    querySelectorAll: (selector) => (selector === '.follow-toast__count' ? counters : []),
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
    button, classes, counters, intervals,
    tick: () => fireAll(intervals),
    fireTimeouts: () => fireAll(timeouts),
    values: () => counters.map((counter) => Number(counter.textContent.replace(/\D/g, ''))),
  };
}

test('the banner arrives with believable counts that climb for five seconds', () => {
  const t = setup();
  t.button.hover();
  assert.ok(t.classes.has('is-visible'), 'the banner shows up at once');
  const start = t.values();
  assert.equal(start.length, 3, 'three counts ride the banner');
  assert.ok(start[0] >= 1100 && start[0] <= 2600, 'likes start high');
  assert.ok(start[1] >= 28 && start[1] <= 92, 'comments keep a human scale');
  assert.ok(start[2] >= 26 && start[2] <= 96, 'followers keep a human scale');
  assert.ok(t.counters.every((counter) => !counter.textContent.includes('+')), 'plain numbers, like the reference');

  t.tick();
  t.tick();
  const grown = t.values();
  assert.ok(grown.every((value, i) => value > start[i]), 'every count climbs while hovering');

  t.fireTimeouts();
  const frozen = t.values();
  t.tick();
  assert.deepEqual(t.values(), frozen, 'the climb stops after five seconds');
});

test('the counts fall for five seconds and then the banner departs', () => {
  const t = setup();
  t.button.hover();
  t.fireTimeouts();
  const peak = t.values();

  t.button.leave();
  t.tick();
  t.tick();
  assert.ok(t.values().every((value, i) => value < peak[i]), 'every count falls after the cursor leaves');

  t.fireTimeouts();
  assert.ok(!t.classes.has('is-visible'), 'the banner departs five seconds after the cursor leaves');
});

test('hovering again during the fall resumes the climb immediately', () => {
  const t = setup();
  t.button.hover();
  t.fireTimeouts();
  t.button.leave();
  t.tick();
  const fallen = t.values();
  assert.ok(fallen.every((value) => value > 0), 'the counts have not drained to zero yet');

  t.button.hover();
  assert.ok(t.classes.has('is-visible'));
  assert.deepEqual(t.values(), fallen, 'the climb resumes from the current counts');

  t.tick();
  assert.ok(t.values().every((value, i) => value > fallen[i]), 'the counts climb again without waiting');
});

test('a fresh hover after the banner departs starts new counts', () => {
  const t = setup();
  t.button.hover();
  t.button.leave();
  t.fireTimeouts();
  t.fireTimeouts();
  assert.ok(!t.classes.has('is-visible'));

  t.button.hover();
  const fresh = t.values();
  assert.ok(fresh[0] >= 1100, 'a fresh likes count arrives');
  assert.ok(t.classes.has('is-visible'));
});
