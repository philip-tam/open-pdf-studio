// Page Dewarp tool: let the user click a series of points along one or more
// text lines that should be straight but curve (book-gutter warp), then
// non-linearly warp the page so those curves become level. Mirrors
// straighten-select.js's mount/confirm/cancel flow, but captures multi-
// point curves instead of a single dragged line — confirming opens a
// preview dialog rather than applying directly, since a bad guide curve is
// much harder to "eyeball" correctly than a straight one.
import { getActiveDocument } from '../core/state.js';
import { updateStatusMessage } from '../ui/chrome/status-bar.js';
import { render } from 'solid-js/web';
import DewarpOverlay from '../solid/components/DewarpOverlay.jsx';
import { startScreenshot, endScreenshot, openDialog } from '../bridge.js';
import { getCurrentCanvases, selectionToAppRect } from './screenshot.js';

let disposeOverlay = null;

function mountOverlay(container) {
  const mountId = 'dewarp-select-overlay-root';
  let mountEl = container.querySelector('#' + mountId);
  if (!mountEl) {
    if (disposeOverlay) {
      disposeOverlay();
      disposeOverlay = null;
    }
    mountEl = document.createElement('div');
    mountEl.id = mountId;
    mountEl.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:500;';
    container.appendChild(mountEl);
  }
  return mountEl;
}

function unmountOverlay() {
  if (disposeOverlay) {
    disposeOverlay();
    disposeOverlay = null;
  }
  const mountEl = document.getElementById('dewarp-select-overlay-root');
  if (mountEl) mountEl.remove();
}

// Converts a point in overlay-local CSS px into APP annotation space (page
// points), reusing screenshot.js's existing rect->app-space conversion with
// a zero-size rect — same trick straighten-select.js uses.
function pointToAppSpace(x, y, container) {
  const rect = selectionToAppRect({ left: x, top: y, width: 0, height: 0 }, container);
  return rect ? { x: rect.x, y: rect.y } : null;
}

/**
 * Start the Page Dewarp flow on the current page: click points along a
 * curved guide line (optionally more than one — see DewarpOverlay), Enter
 * to confirm and open the preview dialog, Escape to cancel.
 */
export function startDewarpPage() {
  const doc = getActiveDocument();
  if (!doc?.pdfDoc) {
    updateStatusMessage('Open a PDF first to dewarp it');
    return;
  }

  const canvases = getCurrentCanvases();
  if (!canvases) {
    updateStatusMessage('No PDF page to dewarp');
    return;
  }

  const container = canvases.container;
  container.style.position = container.style.position || 'relative';

  unmountOverlay();
  endScreenshot();

  const mountEl = mountOverlay(container);
  mountEl.style.pointerEvents = 'auto';

  disposeOverlay = render(
    () =>
      DewarpOverlay({
        onConfirm: (curves) => {
          const appCurves = curves
            .map((pts) => pts.map((p) => pointToAppSpace(p.x, p.y, container)).filter(Boolean))
            .filter((pts) => pts.length >= 3);
          unmountOverlay();
          if (appCurves.length === 0) {
            updateStatusMessage('Dewarp cancelled');
            return;
          }
          openDialog('dewarp-page', { curves: appCurves });
        },
        onCancel: () => {
          updateStatusMessage('Dewarp cancelled');
          unmountOverlay();
        },
      }),
    mountEl
  );
}
