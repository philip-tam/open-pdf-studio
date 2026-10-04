import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scaleToPercent, percentToScale, cssPxPerPtAt100, normalizeZoomDpi, setZoomDpi, getZoomDpi,
  DEFAULT_ZOOM_DPI,
} from './zoom-display.js';

test('standaard 110 dpi (gelijk aan Acrobat): 100% is 110/72 CSS px per pt', () => {
  assert.equal(DEFAULT_ZOOM_DPI, 110);
  assert.equal(cssPxPerPtAt100(), 110 / 72);
  assert.equal(percentToScale(100), 110 / 72);
  assert.equal(scaleToPercent(110 / 72), 100);
});

test('de oude schaal 1,5 toont 98% bij 110 dpi', () => {
  assert.equal(scaleToPercent(1.5), 98);
});

test('een hogere dpi maakt 100% groter (zoals Acrobat op dit scherm)', () => {
  assert.ok(Math.abs(percentToScale(100, 120) - 120 / 72) < 1e-12);
  assert.equal(scaleToPercent(120 / 72, 120), 100);
  assert.ok(percentToScale(100, 120) > percentToScale(100, 110));
});

test('dpi wordt begrensd en rommel valt terug op 96', () => {
  assert.equal(normalizeZoomDpi(10), 50);
  assert.equal(normalizeZoomDpi(9999), 300);
  assert.equal(normalizeZoomDpi('abc'), DEFAULT_ZOOM_DPI);
  assert.equal(normalizeZoomDpi(undefined), DEFAULT_ZOOM_DPI);
});

test('setZoomDpi stuurt de standaardwaarde van de omrekening', () => {
  setZoomDpi(96);
  assert.equal(getZoomDpi(), 96);
  assert.equal(scaleToPercent(96 / 72), 100);
  setZoomDpi(110);
});

test('heen en terug blijft op hetzelfde procent', () => {
  for (const p of [10, 25, 50, 75, 100, 125, 150, 200, 300, 500]) {
    assert.equal(scaleToPercent(percentToScale(p)), p);
  }
});
