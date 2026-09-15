import { applyToolTransform } from '../tool-context.js';
import { createAnnotation } from '../../annotations/factory.js';

// Wipeout Brush: drag to paint a continuous white stroke over scan dirt,
// like a round paintbrush — replaces the earlier rectangle/freeform Wipeout
// tools with one radius-adjustable brush. Mirrors draw-tool.js's freehand
// path capture exactly (path array, round caps/joins so it reads as a
// continuous stroke rather than a series of segments); the only differences
// are a forced opaque-white style (never the user's ink color/width) and
// the radius coming from state.preferences.wipeoutBrushRadiusMm instead of
// the shared line-width picker.
const MM_TO_POINTS = 72 / 25.4;

function radiusToLineWidth(state) {
  const radiusMm = state.preferences.wipeoutBrushRadiusMm ?? 6;
  return radiusMm * 2 * MM_TO_POINTS;
}

export const wipeoutBrushTool = {
  name: 'wipeoutBrush',
  cursor: 'crosshair',

  onPointerDown(ctx) {
    const { x, y, state } = ctx;
    state.isWipeoutBrushing = true;
    state.wipeoutBrushPath = [{ x, y }];
  },

  onPointerMove(ctx) {
    const { x, y, state, canvasCtx } = ctx;
    if (!state.isWipeoutBrushing) return;

    state.wipeoutBrushPath.push({ x, y });

    canvasCtx.save();
    applyToolTransform(canvasCtx);
    canvasCtx.strokeStyle = '#ffffff';
    canvasCtx.lineWidth = radiusToLineWidth(state);
    canvasCtx.globalAlpha = 1;
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';
    canvasCtx.beginPath();
    const path = state.wipeoutBrushPath;
    canvasCtx.moveTo(path[path.length - 2].x, path[path.length - 2].y);
    canvasCtx.lineTo(x, y);
    canvasCtx.stroke();
    canvasCtx.restore();
  },

  onPointerUp(ctx) {
    const { state } = ctx;
    if (!state.isWipeoutBrushing) return false;
    state.isWipeoutBrushing = false;

    const path = state.wipeoutBrushPath;
    state.wipeoutBrushPath = null;
    if (!path || path.length < 1) return false;

    // A single click (no drag) still needs a visible dab — duplicate the
    // point so the round-cap stroke renders as a dot instead of nothing.
    const finalPath = path.length === 1 ? [path[0], path[0]] : path;

    const doc = state.documents[state.activeDocumentIndex];
    if (!doc) return false;
    const ann = createAnnotation({
      type: 'draw',
      page: doc.currentPage,
      path: finalPath,
      color: '#ffffff',
      strokeColor: '#ffffff',
      lineWidth: radiusToLineWidth(state),
      borderStyle: 'solid',
      opacity: 1,
    });
    doc.annotations.push(ann);
    ctx.recordAdd(ann);
    ctx.redraw();
    return true;
  },
};
