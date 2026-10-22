import { state, getActiveDocument } from '../../core/state.js';
import { applyToolTransform } from '../tool-context.js';
import { updateStatusMessage } from '../../ui/chrome/status-bar.js';
import i18next from '../../i18n/config.js';
import { dominanteAs, lengteLangsAs } from '../../annotations/schaal-xy.js';

/**
 * Calibrate the drawing per axis (an old plan whose x and y scales differ).
 *
 * Click the two ends of a known dimension (any dimension along the x-axis or
 * the y-axis; the axis follows the direction of the line). A dialog asks for
 * the real size (m, cm, mm, feet and inches). Then the tool asks whether the
 * other axis should be calibrated too; if so, trace a dimension along it.
 * Measurements then use both scales (annotations/schaal-xy.js).
 */

const AS_KLEUR = { x: '#e81123', y: '#0078d4' };

// Tool state: the first click, the cursor, the axes measured so far.
let _begin = null;
let _bezig = false; // a dialog is open: ignore clicks
let _gemeten = { x: null, y: null };

const t = (sleutel, opties) => i18next.t(`dialogs:calibrateXy.${sleutel}`, opties);

function reset() {
  _begin = null;
  _bezig = false;
  _gemeten = { x: null, y: null };
  state.isDrawingDimension = false;
}

function asNaam(as) {
  return t(as === 'x' ? 'axisX' : 'axisY');
}

async function rondTraceAf(ctx, eind) {
  const dx = eind.x - _begin.x;
  const dy = eind.y - _begin.y;
  const as = dominanteAs(dx, dy);
  const punten = lengteLangsAs(dx, dy, as);
  const doc = getActiveDocument();
  if (_gemeten[as]) {
    updateStatusMessage(t('sameAxis', { axis: asNaam(as) }), 6000);
    _begin = null;
    state.isDrawingDimension = false;
    ctx.redraw();
    return;
  }
  _bezig = true;
  try {
    const { vraagAsMaat, pasKalibratieToe, vraagOokAndereAs } = await import('../../annotations/kalibratie-xy.js');
    const maat = await vraagAsMaat(as, punten);
    if (!maat) {
      _begin = null;
      state.isDrawingDimension = false;
      ctx.redraw();
      return;
    }
    _gemeten[as] = { punten, waarde: maat.waarde, eenheid: maat.eenheid };
    _begin = null;
    state.isDrawingDimension = false;
    ctx.redraw();
    const andere = as === 'x' ? 'y' : 'x';
    if (!_gemeten[andere] && await vraagOokAndereAs(as, andere)) {
      updateStatusMessage(t('traceOther', { axis: asNaam(andere) }), 8000);
      return;
    }
    await pasKalibratieToe(doc, _gemeten);
    reset();
    import('../manager.js').then((m) => m.maybeRevertToSelect && m.maybeRevertToSelect());
  } finally {
    _bezig = false;
  }
}

export const calibrateXyTool = {
  name: 'calibrateXY',
  cursor: 'crosshair',

  onActivate() {
    reset();
    updateStatusMessage(t('traceFirst'), 8000);
  },

  onPointerDown(ctx, e) {
    const { x, y, scale } = ctx;
    if (e.button === 2) {
      this.onEscape(ctx);
      return;
    }
    if (_bezig) return;
    const snap = ctx.snap(x, y, null, _begin ? [_begin] : []);
    const punt = { x: snap.snapped ? snap.x : x, y: snap.snapped ? snap.y : y };
    if (!_begin) {
      _begin = punt;
      state.isDrawingDimension = true;
      return;
    }
    const dx = punt.x - _begin.x;
    const dy = punt.y - _begin.y;
    if (Math.hypot(dx, dy) < 3 / scale) return;
    rondTraceAf(ctx, punt);
  },

  onPointerMove(ctx) {
    const { x, y, canvasCtx, scale } = ctx;
    if (!_begin) {
      const snap = ctx.snap(x, y);
      if (snap.snapped) {
        state.lastSnapResult = snap;
        ctx.redraw();
        ctx.drawSnapIndicator(snap);
      } else if (state.lastSnapResult) {
        state.lastSnapResult = null;
        ctx.redraw();
      }
      return;
    }
    const snap = ctx.snap(x, y, null, [_begin]);
    const eind = { x: snap.snapped ? snap.x : x, y: snap.snapped ? snap.y : y };
    state.lastSnapResult = snap.snapped ? snap : null;
    const as = dominanteAs(eind.x - _begin.x, eind.y - _begin.y);
    ctx.redraw();
    canvasCtx.save();
    applyToolTransform(canvasCtx);
    canvasCtx.strokeStyle = AS_KLEUR[as];
    canvasCtx.lineWidth = Math.max(1.5, 1.5 / scale);
    canvasCtx.setLineDash([]);
    canvasCtx.beginPath();
    canvasCtx.moveTo(_begin.x, _begin.y);
    canvasCtx.lineTo(eind.x, eind.y);
    canvasCtx.stroke();
    // End ticks perpendicular to the axis, so the traced length reads clearly.
    const tik = 6 / scale;
    canvasCtx.beginPath();
    if (as === 'x') {
      canvasCtx.moveTo(_begin.x, _begin.y - tik); canvasCtx.lineTo(_begin.x, _begin.y + tik);
      canvasCtx.moveTo(eind.x, eind.y - tik); canvasCtx.lineTo(eind.x, eind.y + tik);
    } else {
      canvasCtx.moveTo(_begin.x - tik, _begin.y); canvasCtx.lineTo(_begin.x + tik, _begin.y);
      canvasCtx.moveTo(eind.x - tik, eind.y); canvasCtx.lineTo(eind.x + tik, eind.y);
    }
    canvasCtx.stroke();
    canvasCtx.restore();
    if (snap.snapped) ctx.drawSnapIndicator(snap);
    updateStatusMessage(t('tracing', { axis: asNaam(as) }), 2000);
  },

  onEscape(ctx) {
    const was = !!_begin || _gemeten.x || _gemeten.y;
    reset();
    ctx.redraw();
    return !!was;
  },

  onDeactivate(ctx) {
    reset();
    ctx.redraw();
  },
};
