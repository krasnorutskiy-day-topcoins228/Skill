import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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

test('navigation and calls to action point to existing sections', () => {
  for (const id of ['about', 'results', 'projects', 'services', 'contact']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(html, new RegExp(`href=["']#${id}["']`));
  }
  for (const [, id] of html.matchAll(/href=["']#([^"']+)["']/g)) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `Missing anchor: ${id}`);
  }
});

test('the supplied result and its evidence gallery are present', () => {
  assert.match(html, /10(?:\s|&nbsp;|&#160;)*000/);
  assert.match(html, /один месяц/i);
  assert.match(html, /metric--feature/);
  assert.match(html, /evidence__gallery/);
});

test('both project categories open to show the requested case fields', () => {
  assert.ok((html.match(/<details\b/g) || []).length >= 2);
  for (const field of ['Срок сотрудничества', 'Стартовая точка', 'Задачи', 'Результаты']) {
    assert.ok(html.includes(field), `Missing case field: ${field}`);
  }
});

test('hero uses local rose imagery, moving petals and reduced-motion fallback', () => {
  assert.match(html, /assets\/rose-hero\.webp/);
  assert.match(html, /assets\/rose-petal\.png/);
  assert.ok(existsSync('assets/rose-hero.webp'));
  assert.ok(existsSync('assets/rose-petal.png'));
  assert.match(css, /@keyframes/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test('font files are local and include a browser fallback', () => {
  assert.match(css, /@font-face/);
  assert.match(css, /manrope-cyrillic-400-normal\.woff2/);
  assert.match(css, /manrope-cyrillic-400-normal\.woff/);
  assert.match(css, /sans-serif/);
});

test('all local images and fonts referenced by the page exist', () => {
  const htmlAssets = [...html.matchAll(/(?:src|srcset|href)=["'](assets\/[^"']+)["']/g)].map(match => match[1]);
  const cssAssets = [...css.matchAll(/url\(["']?(assets\/[^"')]+)["']?\)/g)].map(match => match[1]);
  assert.ok(htmlAssets.length > 0 && cssAssets.length > 0);
  for (const asset of [...htmlAssets, ...cssAssets]) {
    assert.ok(existsSync(asset), `Missing local asset: ${asset}`);
  }
});
