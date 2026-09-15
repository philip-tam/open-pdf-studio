import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDewarpField, computeMaxSag, buildMultiCurveDewarpField } from './dewarp-geometry.js';

test('a straight curve produces near-zero displacement everywhere', () => {
  const points = [{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 200, y: 100 }];
  const field = buildDewarpField(points, 300);
  assert.ok(Math.abs(field.displacementAt(0, 100)) < 1e-6);
  assert.ok(Math.abs(field.displacementAt(100, 100)) < 1e-6);
  assert.ok(Math.abs(field.displacementAt(200, 100)) < 1e-6);
  assert.ok(Math.abs(field.displacementAt(50, 300)) < 1e-6);
});

test('a curve that sags downward in the middle gets a negative (upward) correction there', () => {
  // Endpoints at y=100, middle sags to y=150 (app space, Y grows downward)
  // — the target height is the endpoints' average (100), so the middle
  // needs to move UP (negative correction) to reach it.
  const points = [{ x: 0, y: 100 }, { x: 100, y: 150 }, { x: 200, y: 100 }];
  const field = buildDewarpField(points, 1000);
  const midCorrection = field.displacementAt(100, 150);
  assert.ok(midCorrection < 0, `expected a negative (upward) correction at the sag, got ${midCorrection}`);
  // Endpoints are already at the target height — negligible correction there.
  assert.ok(Math.abs(field.displacementAt(0, 100)) < 1e-6);
  assert.ok(Math.abs(field.displacementAt(200, 100)) < 1e-6);
});

test('correction fades to zero beyond influenceHeight from the curve', () => {
  const points = [{ x: 0, y: 100 }, { x: 100, y: 150 }, { x: 200, y: 100 }];
  const field = buildDewarpField(points, 50);
  // At the curve's own height, full correction applies.
  const atCurve = field.displacementAt(100, 150);
  assert.ok(atCurve !== 0);
  // Far below the influence band, the correction is exactly zero (allow -0).
  const farBelow = field.displacementAt(100, 150 + 500);
  assert.ok(Math.abs(farBelow) < 1e-9);
});

test('curveYAt extrapolates the endpoint slope (not a flat clamp) just outside the curve\'s x-range', () => {
  // A curve sloping steadily upward-in-y (app space) as x increases.
  const points = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 100 }];
  const field = buildDewarpField(points, 0);
  const justPastEnd = field.curveYAt(105);
  // Slope is 1 (y grows 1 per x); a flat clamp would give exactly 100, a
  // continuing-slope extrapolation gives ~105 instead.
  assert.ok(justPastEnd > 100, `expected extrapolation past the endpoint value, got ${justPastEnd}`);
  assert.ok(Math.abs(justPastEnd - 105) < 1, `expected ~105 (slope-continued), got ${justPastEnd}`);
});

test('displacement tapers smoothly (no abrupt kink) past the curve\'s drawn x-range', () => {
  const points = [{ x: 0, y: 100 }, { x: 100, y: 150 }, { x: 200, y: 100 }];
  const field = buildDewarpField(points, 0);
  // Sample displacement just inside, at, and just outside the right
  // endpoint (x=200) — consecutive differences should stay small and of
  // consistent sign, i.e. no sudden jump/reversal at the boundary itself.
  const xs = [195, 198, 200, 202, 205, 210, 230, 260];
  const ys = xs.map((x) => field.displacementAt(x, field.curveYAt(x)));
  for (let i = 1; i < ys.length; i++) {
    const step = Math.abs(xs[i] - xs[i - 1]);
    const delta = Math.abs(ys[i] - ys[i - 1]);
    // A kink would show as a delta wildly disproportionate to the x step;
    // a smooth taper keeps consecutive deltas bounded and roughly
    // monotonic in magnitude as we move away from the curve.
    assert.ok(delta < 5 * step, `unexpectedly large jump between x=${xs[i - 1]} and x=${xs[i]}: ${delta}`);
  }
  // And it does reach ~0 well beyond the taper margin.
  assert.ok(Math.abs(field.displacementAt(1000, field.curveYAt(1000))) < 1e-6);
});

test('asymmetric influence: a small "below" distance fades out below the curve much sooner than above', () => {
  const points = [{ x: 0, y: 100 }, { x: 100, y: 150 }, { x: 200, y: 100 }];
  const field = buildDewarpField(points, { above: 500, below: 10 });
  const cy = field.curveYAt(100);
  // 30 units below the curve: below-influence (10) has already faded to 0.
  assert.ok(Math.abs(field.displacementAt(100, cy + 30)) < 1e-9);
  // 30 units above the curve: above-influence (500) is still mostly active.
  assert.ok(Math.abs(field.displacementAt(100, cy - 30)) > 1e-6);
});

test('fewer than 2 points produces no field', () => {
  assert.equal(buildDewarpField([], 100), null);
  assert.equal(buildDewarpField([{ x: 0, y: 0 }], 100), null);
});

test('a curve with zero influenceHeight applies full, unfaded correction (still tapered by x-falloff far away)', () => {
  const points = [{ x: 0, y: 100 }, { x: 100, y: 150 }, { x: 200, y: 100 }];
  const field = buildDewarpField(points, 0);
  // Directly above/below the curve itself (within its x-range), no y-falloff.
  assert.equal(field.displacementAt(100, 9999), field.displacementAt(100, 150));
});

test('computeMaxSag reports ~0 for a straight curve and the real peak sag for a bowed one', () => {
  const straight = [{ x: 0, y: 100 }, { x: 100, y: 100 }, { x: 200, y: 100 }];
  assert.ok(computeMaxSag(straight) < 1e-6);

  // Endpoints at y=100, middle at y=150: peak sag from the target (100) is 50.
  const bowed = [{ x: 0, y: 100 }, { x: 100, y: 150 }, { x: 200, y: 100 }];
  const sag = computeMaxSag(bowed);
  assert.ok(Math.abs(sag - 50) < 1, `expected ~50, got ${sag}`);
});

test('computeMaxSag on fewer than 2 points is 0, not a crash', () => {
  assert.equal(computeMaxSag([]), 0);
  assert.equal(computeMaxSag([{ x: 0, y: 0 }]), 0);
});

test('buildMultiCurveDewarpField: each curve corrects its own region independently', () => {
  const topCurve = [{ x: 0, y: 50 }, { x: 100, y: 80 }, { x: 200, y: 50 }];
  const bottomCurve = [{ x: 0, y: 700 }, { x: 100, y: 670 }, { x: 200, y: 700 }];
  // A finite influence distance so each curve's correction localizes near
  // its own region instead of reaching the whole page (which is the whole
  // point of drawing two curves instead of one).
  const field = buildMultiCurveDewarpField([topCurve, bottomCurve], 100);
  const atTop = field.displacementAt(100, 80);
  const atBottom = field.displacementAt(100, 670);
  assert.ok(atTop < -1e-6, `expected a real correction near the top curve, got ${atTop}`);
  assert.ok(atBottom > 1e-6, `expected a real correction near the bottom curve, got ${atBottom}`);
  // Midway between them (400), both curves' influence has faded out.
  assert.ok(Math.abs(field.displacementAt(100, 400)) < 1e-6);
  // Far off to the side must not throw and must return a finite number.
  assert.ok(Number.isFinite(field.displacementAt(1000, 400)));
});

test('buildMultiCurveDewarpField with no curves returns null', () => {
  assert.equal(buildMultiCurveDewarpField([], 0), null);
  assert.equal(buildMultiCurveDewarpField([[]], 0), null);
});
