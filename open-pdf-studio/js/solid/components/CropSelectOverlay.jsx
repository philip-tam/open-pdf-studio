import { Show, createEffect } from 'solid-js';
import { active, selectionRect, setSelectionRect, onComplete, onCancel, endScreenshot } from '../stores/screenshotStore.js';

// Drag-select overlay for the freeform crop tool (tools/crop-select.js).
// Reuses the same generic screenshotStore as ScreenshotOverlay.jsx, but a
// crop is a page-structure edit — not an instant capture — so it waits for
// an explicit Enter to confirm instead of applying on mouse-up. Releasing
// the mouse just freezes the rectangle in place; dragging again before
// confirming replaces it.
export default function CropSelectOverlay() {
  let overlayRef;
  let isDragging = false;
  let startX = 0, startY = 0;

  // Derived (not a separate tracked flag) so it always matches the current
  // selectionRect(), including right after mouse-up when nothing else
  // changes selectionRect itself.
  const isValidSelection = () => {
    const s = selectionRect();
    return !!(s && s.width > 5 && s.height > 5);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    const rect = overlayRef.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    setSelectionRect({ left: startX, top: startY, width: 0, height: 0 });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = overlayRef.getBoundingClientRect();
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    setSelectionRect({
      left: Math.min(startX, curX),
      top: Math.min(startY, curY),
      width: Math.abs(curX - startX),
      height: Math.abs(curY - startY),
    });
  };

  const handleMouseUp = () => {
    // Deliberately do NOT confirm here — the rectangle stays visible,
    // adjustable (drag again to replace it), until Enter or Escape.
    isDragging = false;
  };

  const confirm = () => {
    if (!isValidSelection()) return;
    const sel = selectionRect();
    const completeFn = onComplete();
    endScreenshot();
    if (completeFn) completeFn(sel);
  };

  const cancel = () => {
    const cancelFn = onCancel();
    endScreenshot();
    if (cancelFn) cancelFn();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      confirm();
    } else if (e.key === 'Escape') {
      cancel();
    }
  };

  createEffect(() => {
    if (active() && overlayRef) {
      overlayRef.focus();
    }
  });

  return (
    <Show when={active()}>
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
          {isValidSelection()
            ? 'Press Enter to crop, Esc to cancel. Drag again to change the area.'
            : 'Click and drag to select the crop area. Press Esc to cancel.'}
        </div>
        <Show when={selectionRect()}>
          {(rect) => (
            <div style={{
              position: 'absolute',
              left: rect().left + 'px',
              top: rect().top + 'px',
              width: rect().width + 'px',
              height: rect().height + 'px',
              border: '2px dashed #0078d7',
              background: 'rgba(0, 120, 215, 0.1)',
              'pointer-events': 'none',
            }} />
          )}
        </Show>
      </div>
    </Show>
  );
}
