// Freeform crop: let the user drag a rectangle directly on the current page
// and crop to exactly that area, instead of only the auto-detected content
// bounds (see pdf/crop-margins.js's `cropMargins`). Reuses the region
// screenshot tool's rect-to-page-space conversion (tools/screenshot.js), but
// — unlike that tool's instant-capture drag — waits for an explicit Enter to
// confirm (CropSelectOverlay.jsx): a crop edits the page structure, so it
// gets a review step instead of applying the moment the mouse lifts.
import { getActiveDocument } from '../core/state.js';
import { updateStatusMessage } from '../ui/chrome/status-bar.js';
import { render } from 'solid-js/web';
import CropSelectOverlay from '../solid/components/CropSelectOverlay.jsx';
import { startScreenshot, endScreenshot } from '../bridge.js';
import { getCurrentCanvases, selectionToAppRect, clampAppRect } from './screenshot.js';

let disposeOverlay = null;

function mountOverlay(container) {
  const mountId = 'crop-select-overlay-root';
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
    disposeOverlay = render(() => CropSelectOverlay(), mountEl);
  }
  return mountEl;
}

function unmountOverlay() {
  if (disposeOverlay) {
    disposeOverlay();
    disposeOverlay = null;
  }
  const mountEl = document.getElementById('crop-select-overlay-root');
  if (mountEl) mountEl.remove();
}

/**
 * Start the freeform (mouse-drag) crop flow on the current page. Drag to
 * select, release to freeze the rectangle (drag again to redo it), Enter to
 * apply the crop, Escape to cancel.
 */
export function startFreeformCrop() {
  const doc = getActiveDocument();
  if (!doc?.pdfDoc) {
    updateStatusMessage('Open a PDF first to crop it');
    return;
  }

  const canvases = getCurrentCanvases();
  if (!canvases) {
    updateStatusMessage('No PDF page to crop');
    return;
  }

  const container = canvases.container;
  container.style.position = container.style.position || 'relative';

  unmountOverlay();
  endScreenshot();

  const mountEl = mountOverlay(container);
  mountEl.style.pointerEvents = 'auto';

  const pageNum = doc.currentPage || 1;

  startScreenshot(
    container,
    async (sel) => {
      const appRect = clampAppRect(selectionToAppRect(sel, container));
      unmountOverlay();

      if (!appRect) {
        updateStatusMessage('Selection too small');
        return;
      }

      const { cropToSelection } = await import('../pdf/crop-margins.js');
      const ok = await cropToSelection(pageNum, appRect);
      updateStatusMessage(ok ? 'Page cropped' : 'Crop failed');
    },
    () => {
      updateStatusMessage('Crop cancelled');
      unmountOverlay();
    }
  );
}
