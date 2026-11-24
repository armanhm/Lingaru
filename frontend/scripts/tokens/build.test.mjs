import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCss, buildArtifactTokens } from './build.mjs';

const tokens = JSON.parse(
  readFileSync(new URL('../../src/design/tokens.json', import.meta.url), 'utf8'),
);
const css = buildCss(tokens);

test('emits ramp steps', () => {
  assert.ok(css.includes('--color-surface-50: #F6F3EC'));
});

test('emits aliases as var() references', () => {
  assert.ok(css.includes('--color-primary-600: var(--color-accent-600)'));
  assert.ok(css.includes('--color-ink-800: var(--color-surface-800)'));
});

test('emits dark overrides for semantic tokens', () => {
  const dark = css.slice(css.indexOf('.dark {'));
  assert.ok(dark.includes('--pp-canvas: #1A1916'));
});

test('maps semantic utilities to custom properties', () => {
  assert.ok(css.includes('--color-canvas: var(--pp-canvas)'));
});

test('emits type tokens with companions', () => {
  assert.ok(css.includes('--text-h1: 2.125rem'));
  assert.ok(css.includes('--text-h1--line-height: 1.1'));
  assert.ok(css.includes('--text-display-xl: 2.5rem'));
});

test('emits no em-dashes', () => {
  assert.ok(!css.includes('—'));
});

test('artifact tokens carry semantic light/dark pairs', () => {
  const art = buildArtifactTokens(tokens);
  assert.equal(art.name, 'Lingaru Paper');
  assert.deepEqual(art.color.canvas, { light: '#F6F3EC', dark: '#1A1916' });
});
