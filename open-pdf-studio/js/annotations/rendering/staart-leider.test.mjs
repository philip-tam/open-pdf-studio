import assert from 'node:assert/strict';
import test from 'node:test';
import {
  staartVoet, staartOmhullende, halveVoet, standaardStaart, staartLijst, vakMetStaartenOpdrachten,
} from './staart-leider.js';

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

const leider = (x, y) => ({ tipX: x, tipY: y, endStyle: 'tail' });

test('staartLijst: alleen geldige staarten, langs de rand gesorteerd', () => {
  const lijst = staartLijst(vak, 'rect', [
    leider(200, 300), leider(200, 150), { tipX: 500, tipY: 150, endStyle: 'arrow' }, leider(200, 20), leider(420, 150),
  ]);
  assert.deepEqual(lijst.map((t) => t.voet.zijde), ['boven', 'rechts', 'onder']);
});

test('vak met staarten: één gesloten omtrek die elke punt bevat', () => {
  for (const vorm of ['rect', 'rounded', 'ellipse']) {
    const punten = [[200, 300], [200, 20], [420, 150], [-30, 150], [330, 260]];
    const lijst = staartLijst(vak, vorm, punten.map(([x, y]) => leider(x, y)));
    const ops = vakMetStaartenOpdrachten(vak, vorm, lijst);
    assert.equal(ops[0][0], 'M', vorm);
    assert.equal(ops[ops.length - 1][0], 'Z', vorm);
    assert.equal(ops.filter((o) => o[0] === 'M').length, 1, `${vorm}: één deelpad`);
    for (const t of lijst) {
      assert.ok(ops.some((o) => o[0] === 'L' && o[1] === t.punt.x && o[2] === t.punt.y), `${vorm}: punt ${t.punt.x},${t.punt.y}`);
    }
  }
});

test('vak zonder staarten geeft een gewone omtrek', () => {
  for (const vorm of ['rect', 'rounded', 'ellipse']) {
    const ops = vakMetStaartenOpdrachten(vak, vorm, []);
    assert.equal(ops[0][0], 'M');
    assert.equal(ops[ops.length - 1][0], 'Z');
  }
});
