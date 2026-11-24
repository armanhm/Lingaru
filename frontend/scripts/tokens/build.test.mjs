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

test('emits serif headings as @utility blocks, not theme variables', () => {
  const block = css.slice(css.indexOf('@utility text-h1 {'));
  const body = block.slice(0, block.indexOf('}'));
  assert.ok(body.includes('font-family: var(--font-editorial)'));
  assert.ok(body.includes('font-size: 2.125rem'));
  assert.ok(body.includes('font-weight: 400 !important'));
  assert.ok(css.includes('@utility text-display-xl {'));
  assert.ok(!css.includes('--text-h1:'));
});

test('keeps UI type as theme variables with companions', () => {
  assert.ok(css.includes('--text-body: 1rem'));
  assert.ok(css.includes('--text-h4--font-weight: 600'));
});

test('--font-display is the Inter stack', () => {
  assert.ok(css.includes("--font-display: 'Inter'"));
});

test('emits no em-dashes', () => {
  assert.ok(!css.includes('—'));
});

test('artifact tokens follow the design-system page format', () => {
  const art = buildArtifactTokens(tokens);
  assert.equal(art.version, 1);
  assert.deepEqual(art.color.themes.map((t) => t.id), ['light', 'dark']);
  const canvas = art.color.tokens.find((t) => t.name === 'canvas');
  assert.deepEqual(canvas.value, { light: '#F6F3EC', dark: '#1A1916' });
  const names = [
    ...art.color.tokens,
    ...art.spacing.tokens,
    ...art.radius.tokens,
  ].map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const n of names) assert.match(n, /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/);
  for (const t of art.color.tokens) {
    assert.ok(t.usage && t.usage.length > 0, `${t.name} needs usage`);
    if (typeof t.value === 'string') assert.match(t.value, /^#[0-9A-Fa-f]{6}$/);
  }
  assert.equal(art.type.groups[0].styles[0].fontSize, '40px');
});
