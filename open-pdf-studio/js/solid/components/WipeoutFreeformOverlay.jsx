import { Show, For, createSignal, createEffect } from 'solid-js';

// Click-to-add-points lasso overlay for the freeform Wipeout tool
// (tools/wipeout-freeform.js): circle an irregular area of dirt/speckle on a
// scan and white it out, for cases a plain rectangle wipeout can't cover
// cleanly. Click points around the area, then close the loop (Enter, or
// clicking back near the first point) to confirm. Backspace removes the
// last point; Esc cancels.
const CLOSE_SNAP_PX = 12;

export default function WipeoutFreeformOverlay(props) {
  let overlayRef;

  const [points, setPoints] = createSignal([]);

  const isValid = () => points().length >= 3;

  const nearFirst = (x, y) => {
    const pts = points();
    if (pts.length < 3) return false;
    const first = pts[0];
    return Math.hypot(x - first.x, y - first.y) <= CLOSE_SNAP_PX;
  };

  const confirm = () => {
    if (!isValid()) return;
    props.onConfirm?.(points());
  };

  const cancel = () => {
    props.onCancel?.();
  };

  const addPoint = (e) => {
    if (e.button !== 0) return;
    overlayRef.focus();
    const rect = overlayRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (nearFirst(x, y)) {
      confirm();
      return;
    }
    setPoints((prev) => [...prev, { x, y }]);
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

  const pathD = () => {
    const pts = points();
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    return d;
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
        {isValid()
          ? props.confirmHint || 'Click near the first point (or press Enter) to close and white out this area · Backspace: remove last point · Esc: cancel'
          : props.drawHint || `Click around the area to erase (${points().length} point(s), 3 needed). Esc to cancel.`}
      </div>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 'pointer-events': 'none' }}>
        <Show when={points().length > 0}>
          <path d={pathD() + (isValid() ? ' Z' : '')} fill={isValid() ? 'rgba(255,255,255,0.6)' : 'none'} stroke="#0078d7" stroke-width="2" stroke-dasharray="6 4" />
          <For each={points()}>
            {(p, i) => (
              <circle
                cx={p.x} cy={p.y}
                r={i() === 0 && isValid() ? 6 : 4}
                fill={i() === 0 && isValid() ? '#5cb85c' : '#0078d7'}
              />
            )}
          </For>
        </Show>
      </svg>
    </div>
  );
}
