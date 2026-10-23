import assert from 'node:assert/strict';
import test from 'node:test';
import { staartVoet, staartOmhullende, halveVoet, standaardStaart } from './staart-leider.js';

const vak = { x: 100, y: 100, width: 200, height: 100 };

test('een punt binnen het vak geeft geen staart', () => {
  for (const vorm of ['rect', 'rounded', 'ellipse']) {
    assert.equal(staartVoet(vak, vorm, { x: 200, y: 150 }), null, vorm);
    assert.equal(staartVoet(vak, vorm, { x: 110, y: 110 }) === null, vorm !== 'ellipse', vorm);
  }
});

test('de staart hangt aan de kant waar de punt naartoe wijst', () => {
  const onder = staartVoet(vak, 'rect', { x: 200, y: 260 });
  assert.equal(onder.p1.y, 200);
  assert.equal(onder.p2.y, 200);
  assert.ok(Math.abs((onder.p1.x + onder.p2.x) / 2 - 200) < 1e-9);
  const boven = staartVoet(vak, 'rect', { x: 200, y: 20 });
  assert.equal(boven.p1.y, 100);
  const rechts = staartVoet(vak, 'rect', { x: 420, y: 150 });
  assert.equal(rechts.p1.x, 300);
  assert.equal(rechts.p2.x, 300);
  const links = staartVoet(vak, 'rect', { x: -50, y: 150 });
  assert.equal(links.p1.x, 100);
});

test('de voet blijft weg van de hoeken, ook als de punt er schuin voor ligt', () => {
  const voet = staartVoet(vak, 'rounded', { x: 600, y: 400 });
  assert.ok(voet.p1.x >= 100 && voet.p2.x <= 300 || voet.p1.y >= 100 && voet.p2.y <= 200);
  const hoek = staartVoet(vak, 'rect', { x: 310, y: 205 });
  // de voet ligt volledig op één rand van het vak
  assert.ok(
    (hoek.p1.x === hoek.p2.x && hoek.p1.y >= 100 && hoek.p2.y <= 200) ||
    (hoek.p1.y === hoek.p2.y && hoek.p1.x >= 100 && hoek.p2.x <= 300));
});

test('ellips: de voetpunten liggen op de ellips', () => {
  const voet = staartVoet(vak, 'ellipse', { x: 120, y: 320 });
  for (const p of [voet.p1, voet.p2, voet.basis]) {
    const u = (p.x - 200) / 100, v = (p.y - 150) / 50;
    assert.ok(Math.abs(u * u + v * v - 1) < 1e-9);
  }
});

test('de voet is breed genoeg en niet te breed', () => {
  assert.equal(halveVoet(1000, 1000), 16);
  assert.equal(halveVoet(10, 10), 4);
  assert.ok(Math.abs(halveVoet(200, 100) - 14) < 1e-9);
});

test('staartOmhullende bevat de voet, de punt en de lijndikte', () => {
  const voet = staartVoet(vak, 'rect', { x: 200, y: 260 });
  const [x1, y1, x2, y2] = staartOmhullende(voet, { x: 200, y: 260 }, 2);
  assert.ok(x1 < voet.p1.x && x2 > voet.p2.x && y1 < 200 && y2 > 260);
});

test('standaardStaart: onder het vak, links van het midden, als staart', () => {
  const s = standaardStaart(vak, 'x1');
  assert.equal(s.id, 'x1');
  assert.equal(s.endStyle, 'tail');
  assert.ok(s.tipY > vak.y + vak.height);
  assert.ok(s.tipX > vak.x && s.tipX < vak.x + vak.width / 2);
  assert.ok(staartVoet(vak, 'rect', { x: s.tipX, y: s.tipY }) !== null);
  assert.ok(staartVoet(vak, 'ellipse', { x: s.tipX, y: s.tipY }) !== null);
});
