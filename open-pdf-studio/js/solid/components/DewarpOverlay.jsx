import { Show, createSignal, createEffect } from 'solid-js';
import { catmullRomToBezier } from '../../annotations/spline-arrow-geometry.js';

// Click-to-add-points overlay for the Page Dewarp tool
// (tools/dewarp-select.js). Unlike Straighten's single drag-drawn straight
// line, correcting book-gutter warp needs a CURVE: each click adds a
// control point along the distorted text line, rendered as a smooth
// Catmull-Rom spline (same curve math the spline-arrow annotation already
// uses) so the user can see exactly what will be treated as "should be
// straight." Backspace removes the last point; Enter confirms (needs at
// least 3 points — 2 would just be a straight line, no curvature to
// correct); Esc cancels.
export default function DewarpOverlay(props) {
  let overlayRef;

  const [points, setPoints] = createSignal([]); // { x, y } in overlay-local CSS px

  const isValidCurve = () => points().length >= 3;

  const pathD = () => {
    const segments = catmullRomToBezier(points());
    if (segments.length === 0) return '';
    const first = segments[0];
    let d = `M ${first.x0} ${first.y0}`;
    for (const s of segments) {
      d += ` C ${s.c1x} ${s.c1y}, ${s.c2x} ${s.c2y}, ${s.x1} ${s.y1}`;
    }
    return d;
  };

  const addPoint = (e) => {
    if (e.button !== 0) return;
    overlayRef.focus();
    const rect = overlayRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPoints((prev) => [...prev, { x, y }]);
  };

  const confirm = () => {
    if (!isValidCurve()) return;
    props.onConfirm?.(points());
  };

  const cancel = () => {
    props.onCancel?.();
  };

  const undoLastPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
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
      onDblClick={confirm}
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
        {isValidCurve()
          ? props.confirmHint || 'Enter: dewarp using this curve · Backspace: remove last point · Esc: cancel'
          : props.drawHint || `Click along a text line that should be straight but curves (${points().length}/3 points). Esc to cancel.`}
      </div>
      <Show when={points().length > 0}>
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 'pointer-events': 'none' }}>
          <path d={pathD()} fill="none" stroke="#0078d7" stroke-width="2" stroke-dasharray="6 4" />
          {points().map((p) => (
            <circle cx={p.x} cy={p.y} r="4" fill="#0078d7" />
          ))}
        </svg>
      </Show>
    </div>
  );
}
