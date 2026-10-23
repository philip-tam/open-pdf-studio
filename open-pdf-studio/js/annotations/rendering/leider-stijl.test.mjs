import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEIDER_STIJLEN, leiderStijlVan, leiderEigenschappen, stijlVanLeider, puntStraal, stippelPatroon, standaardLeider,
} from './leider-stijl.js';

test('leiderStijlVan: onbekend of leeg is de pijl', () => {
  assert.equal(leiderStijlVan({}), 'arrow');
  assert.equal(leiderStijlVan(null), 'arrow');
  assert.equal(leiderStijlVan({ leaderLook: 'tail' }), 'arrow');
  for (const s of LEIDER_STIJLEN) assert.equal(leiderStijlVan({ leaderLook: s }), s);
});

test('leiderEigenschappen: volle of stippellijn, met of zonder bolletje', () => {
  assert.deepEqual(leiderEigenschappen('line'), { endStyle: 'none', dotted: false });
  assert.deepEqual(leiderEigenschappen('lineDot'), { endStyle: 'circle', dotted: false });
  assert.deepEqual(leiderEigenschappen('dotted'), { endStyle: 'none', dotted: true });
  assert.deepEqual(leiderEigenschappen('dottedDot'), { endStyle: 'circle', dotted: true });
  assert.deepEqual(leiderEigenschappen('arrow'), { endStyle: 'arrow', dotted: false });
  assert.deepEqual(leiderEigenschappen('onbekend'), { endStyle: 'arrow', dotted: false });
});

test('stijlVanLeider is het omgekeerde van leiderEigenschappen', () => {
  for (const s of LEIDER_STIJLEN) assert.equal(stijlVanLeider(leiderEigenschappen(s)), s);
  assert.equal(stijlVanLeider({ endStyle: 'tail' }), 'lineDot');
  assert.equal(stijlVanLeider({}), 'arrow');
});

test('bolletje en stippels groeien met de lijndikte', () => {
  assert.ok(puntStraal(1) >= 3);
  assert.ok(puntStraal(6) > puntStraal(1));
  assert.ok(stippelPatroon(1)[1] >= 3);
  assert.ok(stippelPatroon(8)[1] > stippelPatroon(1)[1]);
});

test('standaardLeider: een rechte lijn onder het vak, met de gekozen stijl', () => {
  const vak = { x: 100, y: 100, width: 200, height: 100 };
  const l = standaardLeider(vak, 'dottedDot', 'x1');
  assert.equal(l.id, 'x1');
  assert.equal(l.endStyle, 'circle');
  assert.equal(l.dotted, true);
  assert.ok(l.tipY > 200 && l.tipX < 200);
  // de knik ligt op de rechte lijn van het anker (onderrand, midden) naar de punt
  const ax = 200, ay = 200;
  const kruis = (l.kneeX - ax) * (l.tipY - ay) - (l.kneeY - ay) * (l.tipX - ax);
  assert.ok(Math.abs(kruis) < 1e-9);
});
