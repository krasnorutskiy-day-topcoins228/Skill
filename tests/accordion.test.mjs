import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const script = readFileSync('script.js', 'utf8');

function makeBody(height) {
  return { style: {}, offsetHeight: height, scrollHeight: height };
}

function makeCard(name, height = 300) {
  const listeners = new Map();
  const body = makeBody(height);
  const summary = {
    addEventListener(type, listener) {
      const callbacks = listeners.get(type) || [];
      callbacks.push(listener);
      listeners.set(type, callbacks);
    },
  };
  const card = {
    name,
    open: false,
    dataset: { state: '' },
    __glide: null,
    querySelector(selector) {
      if (selector === 'summary') return summary;
      if (selector === '.project-card__details') return body;
      return null;
    },
    click() {
      let prevented = false;
      for (const listener of listeners.get('click') || []) {
        listener({ preventDefault: () => { prevented = true; } });
      }
      return prevented;
    },
  };
  card.body = body;
  return card;
}

function setup({ cards = [makeCard('business'), makeCard('experts')], reduce = false } = {}) {
  const list = { querySelectorAll: () => cards };
  const document = { querySelector: (selector) => (selector === '.project-list' ? list : null) };
  const timers = new Map();
  let nextId = 1;
  const window = {
    requestAnimationFrame: (callback) => { callback(); return 1; },
    matchMedia: () => ({ matches: reduce }),
    setTimeout: (callback, ms) => { timers.set(nextId, { callback, ms }); return nextId++; },
    clearTimeout: (id) => { timers.delete(id); },
  };
  runInNewContext(script, { document, window });
  const settle = () => {
    const due = [...timers.values()];
    timers.clear();
    for (const { callback } of due) callback();
  };
  return { cards, settle, timers };
}

test('a card click opens the card and glides it shut again', () => {
  const { cards, settle } = setup();
  const [card] = cards;

  assert.equal(card.click(), true, 'The native toggle is prevented so the glide can drive it');
  assert.equal(card.open, true);
  assert.equal(card.body.style.height, '300px', 'The details expand to their full height');
  settle();
  assert.equal(card.dataset.state, '', 'The opening state clears after the glide');
  assert.equal(card.body.style.cssText, '', 'Inline glide styles are removed after the glide');

  assert.equal(card.click(), true);
  assert.equal(card.dataset.state, 'closing');
  assert.equal(card.body.style.height, '0px', 'The details glide back to zero');
  settle();
  assert.equal(card.open, false, 'The card really closes once the glide ends');
  assert.equal(card.dataset.state, '');
});

test('opening one card folds the other', () => {
  const { cards, settle } = setup();
  const [first, second] = cards;

  first.click();
  settle();
  assert.equal(first.open, true);

  second.click();
  assert.equal(second.open, true, 'The clicked card opens');
  assert.equal(first.dataset.state, 'closing', 'The other card starts folding');
  settle();
  assert.equal(first.open, false, 'Only one card stays open at a time');
  assert.equal(second.open, true);
});

test('clicks during the glide reverse it instead of being swallowed', () => {
  const { cards, settle } = setup();
  const [card] = cards;

  card.click();
  card.click();
  settle();
  assert.equal(card.open, false, 'A second click mid-opening closes the card');

  card.click();
  settle();
  assert.equal(card.open, true, 'The card opens again after a full close');

  card.click();
  card.click();
  settle();
  assert.equal(card.open, true, 'A second click mid-closing reopens the card');
  assert.equal(card.dataset.state, '');
});

test('reduced motion toggles the cards instantly', () => {
  const { cards } = setup({ reduce: true });
  const [card] = cards;

  card.click();
  assert.equal(card.open, true);
  assert.equal(card.dataset.state, '', 'No glide state is kept');

  card.click();
  assert.equal(card.open, false);
});
