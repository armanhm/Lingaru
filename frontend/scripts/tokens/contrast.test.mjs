import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contrastRatio } from './contrast.mjs';

const tokens = JSON.parse(
  readFileSync(new URL('../../src/design/tokens.json', import.meta.url), 'utf8'),
);

test('contrastRatio black on white is 21', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(2), '21.00');
});

test('contrastRatio of identical colours is 1', () => {
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
});

test('has the full set of contrast pairs', () => {
  assert.ok(tokens.contrastPairs.length >= 14);
});

for (const mode of ['light', 'dark']) {
  for (const { fg, bg, min } of tokens.contrastPairs) {
    test(`${mode}: ${fg} on ${bg} >= ${min}`, () => {
      const ratio = contrastRatio(
        tokens.semantic[fg][mode],
        tokens.semantic[bg][mode],
      );
      assert.ok(ratio >= min, `${fg}/${bg} ${mode} is ${ratio.toFixed(2)}, needs ${min}`);
    });
  }
}
