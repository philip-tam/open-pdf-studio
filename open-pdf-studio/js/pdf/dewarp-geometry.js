// Pure geometry for Page Dewarp (issue: book-gutter curve correction).
// No imports beyond another pure module, no DOM, no app state — so it can
// be unit-tested under plain `node`, same as spline-arrow-geometry.js.
//
// Transform model: a single user-drawn curve measures vertical sag only
// (dx is always 0 — book-gutter warp bows a line up/down, it doesn't shear
// it sideways). For any point (x, y), the correction is the amount needed
// to bring the curve's height AT x up to the curve's own target height,
// scaled down the further y is from the curve — so the correction is
// strongest right at the guide line and fades out toward the page edges,
// rather than shearing the whole page uniformly. Two independent tapers
// apply:
//   - Vertically (toward the top/bottom edges): a real book page's curve
//     often isn't symmetric above vs. below the guide line — the influence
//     distance can be set separately for each side (`above`/`below`).
//   - Horizontally, past the curve's own leftmost/rightmost drawn point: a
//     hard cutoff there would leave a visible crease (the curve's height
//     has a non-zero slope right at its own endpoint, since most guide
//     curves don't span the full page width — clamping flat past that
//     point discards that slope instantly). A smoothstep taper over a
//     margin keeps both the value AND slope continuous, so there's no
//     visible kink where the curve's drawn extent ends.
import { sampleSplineArrow } from "../annotations/spline-arrow-geometry.js";

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Build the vertical-displacement field for a user-drawn curve, in the same
 * space as the curve's own points (PDF points / app-annotation space — see
 * CLAUDE.md's coordinate-systems note).
 *
 * @param {{x:number,y:number}[]} points - guide-line points, roughly
 *   left-to-right, in the order the user drew them.
 * @param {number | {above?: number, below?: number}} influenceHeight -
 *   distance (same units as points) over which the correction fades from
 *   full strength (at the curve) to zero. A plain number applies the same
 *   distance both above (smaller y, toward the page top) and below (larger
 *   y, toward the page bottom) the curve; pass `{above, below}` to taper
 *   each side independently, since real book-gutter curvature often isn't
 *   symmetric top-to-bottom. 0/omitted on either side means "no falloff on
 *   this side" (full correction all the way to that edge).
 * @returns {null | {
 *   targetY: number,
 *   curveYAt: (x: number) => number,
 *   displacementAt: (x: number, y: number) => number,
 * }}
 */
export function buildDewarpField(points, influenceHeight) {
  if (!points || points.length < 2) return null;

  const samples = sampleSplineArrow(points, 24)
    .slice()
    .sort((a, b) => a.x - b.x);
  if (samples.length < 2) return null;

  const minX = samples[0].x;
  const maxX = samples[samples.length - 1].x;
  const xMargin = Math.max(1, (maxX - minX) * 0.25);

  const targetY = (points[0].y + points[points.length - 1].y) / 2;

  const influence =
    typeof influenceHeight === "object" && influenceHeight !== null
      ? { above: influenceHeight.above || 0, below: influenceHeight.below || 0 }
      : { above: influenceHeight || 0, below: influenceHeight || 0 };

  function curveYAt(x) {
    if (x < minX) {
      // Linearly extrapolate using the first sample's own local slope, so
      // the value AND slope stay continuous at the curve's left end —
      // xFalloff (below) then tapers this extrapolation to nothing over
      // xMargin, rather than an abrupt flat clamp.
      const a = samples[0];
      const b = samples[1] || a;
      const slope = b.x !== a.x ? (b.y - a.y) / (b.x - a.x) : 0;
      return a.y + slope * (x - a.x);
    }
    if (x > maxX) {
      const b = samples[samples.length - 1];
      const a = samples[samples.length - 2] || b;
      const slope = b.x !== a.x ? (b.y - a.y) / (b.x - a.x) : 0;
      return b.y + slope * (x - b.x);
    }
    // Binary search for the bracketing pair, then linear-interpolate.
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].x <= x) lo = mid;
      else hi = mid;
    }
    const a = samples[lo];
    const b = samples[hi];
    const span = b.x - a.x;
    const t = span > 0 ? (x - a.x) / span : 0;
    return a.y + (b.y - a.y) * t;
  }

  // 1 within the curve's own x-range, smoothly (value AND slope) down to 0
  // over xMargin beyond either end.
  function xFalloff(x) {
    if (x < minX) return 1 - smoothstep((minX - x) / xMargin);
    if (x > maxX) return 1 - smoothstep((x - maxX) / xMargin);
    return 1;
  }

  function displacementAt(x, y) {
    const cy = curveYAt(x);
    const correction = (targetY - cy) * xFalloff(x);
    // Signed: negative = above the curve (smaller y, toward the page top),
    // positive = below it — each side tapers by its own influence distance.
    const signedDist = y - cy;
    const inf = signedDist < 0 ? influence.above : influence.below;
    if (!(inf > 0)) return correction;
    const falloff = Math.max(0, 1 - Math.abs(signedDist) / inf);
    return correction * falloff;
  }

  return { targetY, curveYAt, displacementAt };
}

/**
 * How much a single guide curve is actually bowing — the simplest possible
 * readout of "how curved is this," shown to the user (converted to mm by
 * the caller) so drawing a curve gives immediate quantitative feedback, the
 * same way Straighten Page shows its computed angle. The peak distance
 * between the curve and its own target (straightened) height, in the same
 * units as the curve's points.
 * @param {{x:number,y:number}[]} points
 * @returns {number}
 */
export function computeMaxSag(points) {
  if (!points || points.length < 2) return 0;
  const samples = sampleSplineArrow(points, 24);
  const targetY = (points[0].y + points[points.length - 1].y) / 2;
  let max = 0;
  for (const s of samples) {
    const d = Math.abs(s.y - targetY);
    if (d > max) max = d;
  }
  return max;
}

/**
 * Combine multiple independent guide curves (e.g. one near the top of the
 * page, one near the bottom — real book-gutter warp often isn't symmetric
 * top-to-bottom, so two separately-drawn curves are more direct than one
 * curve plus an abstract influence-distance knob) into a single field by
 * summing each curve's own contribution. Curves are expected to be
 * spatially separated (different y ranges) with reasonable influence
 * distances, so overlap — and therefore double-correction — stays small in
 * practice.
 * @param {{x:number,y:number}[][]} curves - one point-array per guide curve.
 * @param {number} influenceHeight - passed through to buildDewarpField for
 *   each curve (symmetric above/below; see buildDewarpField's own docs for
 *   the asymmetric-object form, still supported per curve if needed later).
 * @returns {null | { displacementAt: (x: number, y: number) => number }}
 */
export function buildMultiCurveDewarpField(curves, influenceHeight) {
  const fields = (curves || [])
    .map((pts) => buildDewarpField(pts, influenceHeight))
    .filter(Boolean);
  if (fields.length === 0) return null;
  return {
    displacementAt(x, y) {
      let sum = 0;
      for (const f of fields) sum += f.displacementAt(x, y);
      return sum;
    },
  };
}
