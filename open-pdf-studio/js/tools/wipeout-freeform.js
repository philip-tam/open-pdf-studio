// Freeform Wipeout tool: circle an irregular area (scan dirt, a stray mark)
// with a click-point lasso and white it out permanently. The rectangular
// case is the existing 'mask' shape tool; this covers the "or even circle a
// whole area" irregular case, reusing 'polygon' — already fully supported by
// handles/geometry/transforms/saver/xfdf for an arbitrary points array — with
// an opaque-white, borderless preset instead of building a whole new shape
// type. Mirrors straighten-select.js's mount/confirm/cancel flow.
import { getActiveDocument } from '../core/state.js';
import { updateStatusMessage } from '../ui/chrome/status-bar.js';
import { render } from 'solid-js/web';
import WipeoutFreeformOverlay from '../solid/components/WipeoutFreeformOverlay.jsx';
import { endScreenshot } from '../bridge.js';
import { getCurrentCanvases, selectionToAppRect } from './screenshot.js';
import { createAnnotation } from '../annotations/factory.js';
import { recordAdd } from '../core/undo-manager.js';
import { redrawAnnotations, redrawContinuous } from '../annotations/rendering.js';

let disposeOverlay = null;

function mountOverlay(container) {
  const mountId = 'wipeout-freeform-overlay-root';
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
  const mountEl = document.getElementById('wipeout-freeform-overlay-root');
  if (mountEl) mountEl.remove();
}

function pointToAppSpace(x, y, container) {
  const rect = selectionToAppRect({ left: x, top: y, width: 0, height: 0 }, container);
  return rect ? { x: rect.x, y: rect.y } : null;
}

function createWipeoutPolygon(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  return createAnnotation({
    type: 'polygon',
    page: getActiveDocument()?.currentPage || 1,
    points,
    x, y, width, height,
    color: '#ffffff',
    strokeColor: '#ffffff',
    fillColor: '#ffffff',
    lineWidth: 0,
    opacity: 1,
    locked: true,
  });
}

/**
 * Start the freeform Wipeout flow on the current page: click points around
 * the area to erase, close the loop (Enter, or clicking near the first
 * point) to white it out, Escape to cancel.
 */
export function startWipeoutFreeform() {
  const doc = getActiveDocument();
  if (!doc?.pdfDoc) {
    updateStatusMessage('Open a PDF first');
    return;
  }

  const canvases = getCurrentCanvases();
  if (!canvases) {
    updateStatusMessage('No PDF page to edit');
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
      WipeoutFreeformOverlay({
        onConfirm: (overlayPoints) => {
          const points = overlayPoints
            .map((p) => pointToAppSpace(p.x, p.y, container))
            .filter(Boolean);
          unmountOverlay();
          if (points.length < 3) {
            updateStatusMessage('Wipeout cancelled');
            return;
          }
          const doc2 = getActiveDocument();
          const ann = createWipeoutPolygon(points);
          doc2.annotations.push(ann);
          recordAdd(ann);
          if (doc2.viewMode === 'continuous') redrawContinuous();
          else redrawAnnotations();
          updateStatusMessage('Area erased');
        },
        onCancel: () => {
          updateStatusMessage('Wipeout cancelled');
          unmountOverlay();
        },
      }),
    mountEl
  );
}
