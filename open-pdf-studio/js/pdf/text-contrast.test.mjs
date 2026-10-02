import test from 'node:test';
import assert from 'node:assert/strict';
import { bouwContrastLut, pasContrastToe, contrastGamma } from './text-contrast.js';

test('wit en zwart blijven staan op elk niveau', () => {
  for (const level of [0, 1, 2, 3]) {
    const lut = bouwContrastLut(level);
    assert.equal(lut[0], 0);
    assert.equal(lut[255], 255);
  }
});

test('niveau 0 laat de pixels ongemoeid', () => {
  const px = new Uint8ClampedArray([200, 128, 50, 255]);
  pasContrastToe(px, 0);
  assert.deepEqual([...px], [200, 128, 50, 255]);
});

test('grijs wordt donkerder en een hoger niveau is donkerder', () => {
  const uit = [1, 2, 3].map((l) => bouwContrastLut(l)[160]);
  assert.ok(uit[0] < 160);
  assert.ok(uit[1] < uit[0]);
  assert.ok(uit[2] < uit[1]);
});

test('alpha blijft staan en de LUT is monotoon', () => {
  const px = new Uint8ClampedArray([128, 128, 128, 77]);
  pasContrastToe(px, 2);
  assert.equal(px[3], 77);
  const lut = bouwContrastLut(3);
  for (let i = 1; i < 256; i++) assert.ok(lut[i] >= lut[i - 1]);
});

test('onbekend niveau doet niets', () => {
  assert.equal(contrastGamma(9), 1);
  const px = new Uint8ClampedArray([100, 100, 100, 255]);
  pasContrastToe(px, 9);
  assert.equal(px[0], 100);
});
