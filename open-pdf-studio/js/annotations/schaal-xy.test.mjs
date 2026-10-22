import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pixelsPerUnitY, isAnisotroop, lengteInEenheden, omtrekInEenheden, oppervlakInEenheden, hoekInGraden,
  dominanteAs, lengteLangsAs, voetInchNaarVoet, leesInch, schaalUitAssen,
} from './schaal-xy.js';

const dicht = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const iso = { pixelsPerUnit: 2, unit: 'm' };
const aniso = { pixelsPerUnit: 2, pixelsPerUnitY: 4, unit: 'm' };

test('zonder y-schaal geldt de x-schaal voor beide assen', () => {
  assert.equal(pixelsPerUnitY(iso), 2);
  assert.equal(isAnisotroop(iso), false);
  assert.equal(isAnisotroop(aniso), true);
  assert.equal(isAnisotroop({ ...aniso, pixelsPerUnitY: 2.0001 }), false);
});

test('lengte: langs x met de x-schaal, langs y met de y-schaal', () => {
  assert.ok(dicht(lengteInEenheden(10, 0, aniso), 5));
  assert.ok(dicht(lengteInEenheden(0, 10, aniso), 2.5));
  assert.ok(dicht(lengteInEenheden(6, 8, iso), 5));
  assert.ok(dicht(lengteInEenheden(6, 8, aniso), Math.sqrt(3 ** 2 + 2 ** 2)));
});

test('omtrek telt elke zijde met beide assen', () => {
  const vierkant = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 0, y: 0 }];
  assert.ok(dicht(omtrekInEenheden(vierkant, aniso), 5 + 2.5 + 5 + 2.5));
  assert.ok(dicht(omtrekInEenheden(vierkant, iso), 20));
});

test('oppervlak deelt door x-schaal maal y-schaal', () => {
  assert.ok(dicht(oppervlakInEenheden(100, aniso), 100 / 8));
  assert.ok(dicht(oppervlakInEenheden(100, iso), 25));
});

test('hoek: een hoek van 45 graden op papier is dat in het echt alleen bij gelijke assen', () => {
  const v = { x: 0, y: 0 };
  assert.ok(dicht(hoekInGraden({ x: 10, y: 0 }, v, { x: 10, y: 10 }, iso), 45, 1e-9));
  // y-as is twee keer zo fijn: dy telt half, de hoek wordt kleiner.
  const echt = hoekInGraden({ x: 10, y: 0 }, v, { x: 10, y: 10 }, aniso);
  assert.ok(echt < 45 && echt > 20, String(echt));
  assert.ok(dicht(echt, Math.atan2(2.5, 5) * 180 / Math.PI, 1e-9));
  // zonder schaal: gewone hoek
  assert.ok(dicht(hoekInGraden({ x: 1, y: 0 }, v, { x: 0, y: 1 }, null), 90, 1e-9));
});

test('as van een trace en projectie', () => {
  assert.equal(dominanteAs(100, 20), 'x');
  assert.equal(dominanteAs(-5, 40), 'y');
  assert.equal(dominanteAs(10, 10), 'x');
  assert.equal(lengteLangsAs(-100, 20, 'x'), 100);
  assert.equal(lengteLangsAs(-100, 20, 'y'), 20);
});

test('voet en inch', () => {
  assert.ok(dicht(voetInchNaarVoet(5, 6), 5.5));
  assert.ok(dicht(voetInchNaarVoet(0, 12), 1));
  assert.ok(dicht(voetInchNaarVoet('', ''), 0));
});

test('leesInch: getal, breuk en inchteken', () => {
  assert.equal(leesInch('2'), 2);
  assert.equal(leesInch('2,5'), 2.5);
  assert.equal(leesInch('2 1/2'), 2.5);
  assert.equal(leesInch('2\u00BD'), 2.5);
  assert.equal(leesInch('1/2'), 0.5);
  assert.equal(leesInch('6"'), 6);
  assert.equal(leesInch('6\u2033'), 6);
  assert.equal(leesInch('3 3/4"'), 3.75);
  assert.equal(leesInch('5 3/4'), 5.75);
  assert.equal(leesInch('11 7/8'), 11.875);
  assert.equal(leesInch(''), 0);
  assert.equal(leesInch('  '), 0);
  assert.ok(Number.isNaN(leesInch('abc')));
  assert.ok(Number.isNaN(leesInch('2 1/0')));
});

test('schaalUitAssen: alleen x geeft een gelijke schaal', () => {
  const s = schaalUitAssen({ x: { punten: 200, waarde: 10, eenheid: 'm' } });
  assert.deepEqual(s, { pixelsPerUnit: 20, unit: 'm', method: 'calibrate-xy', scaleRatio: 0 });
});

test('schaalUitAssen: alleen y geeft ook een gelijke schaal', () => {
  const s = schaalUitAssen({ y: { punten: 100, waarde: 4, eenheid: 'm' } });
  assert.equal(s.pixelsPerUnit, 25);
  assert.equal(s.pixelsPerUnitY, undefined);
});

test('schaalUitAssen: twee verschillende assen', () => {
  const s = schaalUitAssen({
    x: { punten: 200, waarde: 10, eenheid: 'm' },
    y: { punten: 100, waarde: 10, eenheid: 'm' },
  });
  assert.equal(s.pixelsPerUnit, 20);
  assert.equal(s.pixelsPerUnitY, 10);
  assert.equal(s.unit, 'm');
});

test('schaalUitAssen: y in een andere eenheid wordt naar die van x omgerekend', () => {
  const s = schaalUitAssen({
    x: { punten: 200, waarde: 10, eenheid: 'm' },
    y: { punten: 100, waarde: 1000, eenheid: 'cm' },
  });
  assert.ok(dicht(s.pixelsPerUnitY, 10));
  assert.equal(s.unit, 'm');
});

test('schaalUitAssen: voet en meter door elkaar', () => {
  const s = schaalUitAssen({
    x: { punten: 304.8, waarde: 10, eenheid: 'ft' },
    y: { punten: 100, waarde: 10, eenheid: 'm' },
  });
  assert.equal(s.unit, 'ft');
  assert.ok(dicht(s.pixelsPerUnit, 30.48));
  // 10 m = 32.8084 ft -> 100 / 32.8084 punten per ft
  assert.ok(dicht(s.pixelsPerUnitY, 100 / (10 * (1000 / 304.8)), 1e-9));
});

test('schaalUitAssen: bijna gelijke assen worden één schaal', () => {
  const s = schaalUitAssen({
    x: { punten: 200, waarde: 10, eenheid: 'm' },
    y: { punten: 100.05, waarde: 5, eenheid: 'm' },
  });
  assert.equal(s.pixelsPerUnitY, undefined);
});

test('schaalUitAssen: ongeldige invoer geeft null', () => {
  assert.equal(schaalUitAssen({}), null);
  assert.equal(schaalUitAssen({ x: { punten: 0, waarde: 10, eenheid: 'm' } }), null);
  assert.equal(schaalUitAssen({ x: { punten: 10, waarde: 10, eenheid: 'parsec' }, y: { punten: 10, waarde: 10, eenheid: 'm' } }), null);
});
