import assert from 'node:assert/strict';
import test from 'node:test';
import {
  kalibratiePad, isBewaardeSchaal, leesKalibratieInhoud, maakKalibratieInhoud,
} from './kalibratie-bestand.js';

test('het zijbestand staat naast de PDF', () => {
  assert.equal(kalibratiePad('/a/b/Plan.pdf'), '/a/b/Plan.pdf.calibration.json');
  assert.equal(kalibratiePad('C:\\x\\Plan.pdf'), 'C:\\x\\Plan.pdf.calibration.json');
});

test('alleen een door de gebruiker gemaakte schaal wordt bewaard', () => {
  assert.equal(isBewaardeSchaal({ method: 'calibrate-xy', pixelsPerUnit: 2 }), true);
  assert.equal(isBewaardeSchaal({ method: 'reference', pixelsPerUnit: 2 }), true);
  assert.equal(isBewaardeSchaal({ method: 'quick-scale', pixelsPerUnit: 2 }), true);
  assert.equal(isBewaardeSchaal({ method: 'auto-detect', pixelsPerUnit: 2 }), false);
  assert.equal(isBewaardeSchaal({ method: 'calibrate-xy', pixelsPerUnit: 0 }), false);
  assert.equal(isBewaardeSchaal(null), false);
});

test('schrijven en lezen geeft dezelfde schaal terug, ook per as', () => {
  const s = { pixelsPerUnit: 30.48, pixelsPerUnitY: 25.4, unit: 'ft', method: 'calibrate-xy', scaleRatio: 0 };
  assert.deepEqual(leesKalibratieInhoud(maakKalibratieInhoud(s)), s);
  const eenvoudig = { pixelsPerUnit: 4, unit: 'm', method: 'reference', scaleRatio: 0 };
  assert.deepEqual(leesKalibratieInhoud(maakKalibratieInhoud(eenvoudig)), eenvoudig);
});

test('een ongeldig bestand geeft null', () => {
  assert.equal(leesKalibratieInhoud('geen json'), null);
  assert.equal(leesKalibratieInhoud('{}'), null);
  assert.equal(leesKalibratieInhoud(JSON.stringify({ measureScale: { pixelsPerUnit: -1, unit: 'm' } })), null);
  assert.equal(leesKalibratieInhoud(JSON.stringify({ measureScale: { pixelsPerUnit: 2 } })), null);
  assert.equal(leesKalibratieInhoud(JSON.stringify({ measureScale: { pixelsPerUnit: 'x', unit: 'm' } })), null);
});

test('onbekende sleutels in het bestand komen niet in de schaal', () => {
  const uit = leesKalibratieInhoud(JSON.stringify({
    measureScale: { pixelsPerUnit: 2, unit: 'm', method: 'reference', __proto__x: 1, evil: 'x' },
  }));
  assert.deepEqual(Object.keys(uit).sort(), ['method', 'pixelsPerUnit', 'scaleRatio', 'unit']);
});

test('een ongeldige y-schaal wordt weggelaten', () => {
  const uit = leesKalibratieInhoud(JSON.stringify({ measureScale: { pixelsPerUnit: 2, pixelsPerUnitY: -3, unit: 'm' } }));
  assert.equal(uit.pixelsPerUnitY, undefined);
});
