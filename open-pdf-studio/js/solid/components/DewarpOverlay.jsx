import { Show, For, createSignal, createMemo, createEffect } from 'solid-js';
import { catmullRomToBezier } from '../../annotations/spline-arrow-geometry.js';
import { computeMaxSag } from '../../pdf/dewarp-geometry.js';

const CURVE_COLORS = ['#0078d7', '#d9534f', '#5cb85c'];

// Click-to-add-points overlay for the Page Dewarp tool
// (tools/dewarp-select.js). Correcting book-gutter warp needs a CURVE, not
// a straight drag like Straighten's overlay: each click adds a control
// point along the distorted text line, rendered as a smooth Catmull-Rom
// spline (same curve math the spline-arrow annotation already uses).
//
// Supports drawing MULTIPLE curves in one session (e.g. one near the top
// of the page, one near the bottom — real book-gutter curvature often
// isn't symmetric top-to-bottom): pressing Enter with 3+ points in the
// current curve commits it and starts a fresh one; pressing Enter again
// with no points in the current (empty) draft finishes and confirms
// everything drawn so far. Backspace removes the last point of whichever
// curve is currently being drawn. Esc cancels the whole operation.
export default function DewarpOverlay(props) {
  let overlayRef;

  const [curves, setCurves] = createSignal([]); // committed curves: {x,y}[][]
  const [draft, setDraft] = createSignal([]); // in-progress curve: {x,y}[]

  const isDraftValid = () => draft().length >= 3;
  const hasAnyCurve = () => curves().length > 0 || isDraftValid();

  const pathD = (points) => {
    const segments = catmullRomToBezier(points);
    if (segments.length === 0) return '';
    const first = segments[0];
    let d = `M ${first.x0} ${first.y0}`;
    for (const s of segments) {
      d += ` C ${s.c1x} ${s.c1y}, ${s.c2x} ${s.c2y}, ${s.x1} ${s.y1}`;
    }
    return d;
  };

  // Peak sag of the curve currently being drawn, converted mm for display
  // — the simplest quantitative "how curved is this" readout, shown live
  // as points are added (mirrors Straighten's angle readout).
  const MM_TO_POINTS = 72 / 25.4;
  const draftSagMm = createMemo(() => {
    if (!isDraftValid()) return 0;
    return computeMaxSag(draft()) / MM_TO_POINTS;
  });

  const addPoint = (e) => {
    if (e.button !== 0) return;
    overlayRef.focus();
    const rect = overlayRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDraft((prev) => [...prev, { x, y }]);
  };

  const confirmAll = () => {
    if (!hasAnyCurve()) return;
    const all = isDraftValid() ? [...curves(), draft()] : curves();
    props.onConfirm?.(all);
  };

  const cancel = () => {
    props.onCancel?.();
  };

  const undoLastPoint = () => {
    setDraft((prev) => prev.slice(0, -1));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isDraftValid()) {
        // Commit the current curve and start a fresh one, so the user can
        // draw a second (or third) guide curve.
        setCurves((prev) => [...prev, draft()]);
        setDraft([]);
      } else if (curves().length > 0) {
        // Nothing new drawn since the last commit — finish.
        confirmAll();
      }
      // else: nothing drawn at all yet, Enter does nothing.
    } else if (e.key === 'Escape') {
      cancel();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      undoLastPoint();
    }
  };

  createEffect(() => {
    if (overlayRef) overlayRef.focus();
  });

  const hintText = () => {
    if (isDraftValid()) {
      return props.confirmHint
        || `Enter: add this curve as a ${curves().length > 0 ? 'second' : 'first'} line, or finish · Backspace: remove last point · Esc: cancel`;
    }
    if (curves().length > 0) {
      return `${curves().length} curve(s) drawn. Click points for another curve, or press Enter to finish. Esc to cancel.`;
    }
    return props.drawHint || `Click along a text line that should be straight but curves (${draft().length}/3 points). Esc to cancel.`;
  };

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        'z-index': '500',
        'pointer-events': 'auto',
        cursor: 'crosshair',
        'user-select': 'none',
      }}
      onMouseDown={addPoint}
      onDblClick={confirmAll}
      onKeyDown={handleKeyDown}
      tabIndex="-1"
    >
      <div style={{
        position: 'absolute',
        top: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.75)',
        color: 'white',
        padding: '6px 14px',
        'font-size': '12px',
        'z-index': '501',
        'pointer-events': 'none',
        'white-space': 'nowrap',
      }}>
        {hintText()}
        <Show when={isDraftValid()}>
          {` · correction ~${draftSagMm().toFixed(1)}mm`}
        </Show>
      </div>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 'pointer-events': 'none' }}>
        <For each={curves()}>
          {(pts, i) => (
            <>
              <path d={pathD(pts)} fill="none" stroke={CURVE_COLORS[i() % CURVE_COLORS.length]} stroke-width="2" />
              <For each={pts}>
                {(p) => <circle cx={p.x} cy={p.y} r="3" fill={CURVE_COLORS[i() % CURVE_COLORS.length]} />}
              </For>
            </>
          )}
        </For>
        <Show when={draft().length > 0}>
          <path d={pathD(draft())} fill="none" stroke={CURVE_COLORS[curves().length % CURVE_COLORS.length]} stroke-width="2" stroke-dasharray="6 4" />
          <For each={draft()}>
            {(p) => <circle cx={p.x} cy={p.y} r="4" fill={CURVE_COLORS[curves().length % CURVE_COLORS.length]} />}
          </For>
        </Show>
      </svg>
    </div>
  );
}
