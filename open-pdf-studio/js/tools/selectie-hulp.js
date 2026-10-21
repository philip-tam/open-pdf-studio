// Selectiehulpen voor de losse selectiegereedschappen van deze fork
// (crop-select.js, straighten-select.js): de canvassen van de huidige pagina en
// de omrekening van een selectie naar paginaruimte. Eerder stonden ze in
// screenshot.js; die is sindsdien herschreven.

import { getActiveDocument } from '../core/state.js';
import { viewportGeometrie, rectNaarPagina, isKwartslag } from '../pdf/weergave-rotatie.js';
import { paginaMaat, weergaveRotatie, weergaveRectNaarPagina } from '../pdf/weergave-ruimte.js';

export function getCurrentCanvases() {
  if (getActiveDocument()?.viewMode === 'continuous') {
    const doc = getActiveDocument();
    const wrapper = document.querySelector(`.page-wrapper[data-page="${doc ? doc.currentPage : 1}"]`);
    if (!wrapper) return null;
    const pdfEl = wrapper.querySelector('.pdf-canvas');
    const annEl = wrapper.querySelector('.annotation-canvas');
    if (!pdfEl || !annEl) return null;
    // Prefer the page's own canvas container (continuous mode uses
    // `.canvas-container-cont`). Falling back to the wrapper would offset
    // the selection by the page-number label above the canvases.
    const contContainer = wrapper.querySelector('.canvas-container-cont')
      || wrapper.querySelector('.canvas-container')
      || wrapper;
    return { pdfCanvas: pdfEl, annotationCanvas: annEl, container: contContainer };
  }
  const pdfEl = document.getElementById('pdf-canvas');
  const annEl = document.getElementById('annotation-canvas');
  const container = document.getElementById('canvas-container');
  if (!pdfEl || !annEl) return null;
  return { pdfCanvas: pdfEl, annotationCanvas: annEl, container };
}

function _currentViewScale(doc) {
  const vp = window.__pdfViewport;
  if (vp && vp.active && doc?.filePath) return vp.zoom || 1;
  return doc?.scale || 1.5;
}

// Page number whose pixels are currently on screen (viewport mode can lag
// doc.currentPage while a new page is still being extracted).
function _capturePageNum(doc) {
  const vp = window.__pdfViewport;
  if (doc?.viewMode !== 'continuous' && vp && vp.active && doc?.filePath && vp.pageNum) {
    return vp.pageNum;
  }
  return doc?.currentPage || 1;
}

// Map a selection rect (CSS px relative to `container`) to app-space
// (page points, top-left origin — the space annotations live in).
// Returns null when there is no document. Een gedraaide weergave (#200) wordt
// teruggedraaid: het resultaat staat altijd in de paginaruimte.
export function selectionToAppRect(sel, container) {
  const doc = getActiveDocument();
  if (!doc) return null;
  const vp = window.__pdfViewport;
  if (doc.viewMode !== 'continuous' && vp && vp.active && doc.filePath) {
    const g = viewportGeometrie(vp);
    const r = rectNaarPagina({
      x: (sel.left - vp.offsetX) / vp.zoom,
      y: (sel.top - vp.offsetY) / vp.zoom,
      width: sel.width / vp.zoom,
      height: sel.height / vp.zoom,
    }, g.paginaBreedte, g.paginaHoogte, g.rotatie);
    return { x: r.x, y: r.y, w: r.width, h: r.height, pageW: g.paginaBreedte, pageH: g.paginaHoogte };
  }
  // Continuous mode / legacy: the container maps 1:1 onto the (possibly
  // rotated) page at doc.scale.
  const s = doc.scale || 1.5;
  const pagina = _capturePageNum(doc);
  const r = weergaveRectNaarPagina(pagina, { x: sel.left / s, y: sel.top / s, width: sel.width / s, height: sel.height / s }, doc);
  const maat = paginaMaat(pagina, doc);
  const draai = isKwartslag(weergaveRotatie(doc));
  return {
    x: r.x,
    y: r.y,
    w: r.width,
    h: r.height,
    pageW: maat ? maat.breedte : (draai ? container.offsetHeight : container.offsetWidth) / s,
    pageH: maat ? maat.hoogte : (draai ? container.offsetWidth : container.offsetHeight) / s,
  };
}

// Clamp an app-space rect to the page bounds; null when nothing remains.
export function clampAppRect(r) {
  if (!r || !(r.pageW > 0) || !(r.pageH > 0)) return null;
  const x = Math.max(0, Math.min(r.x, r.pageW));
  const y = Math.max(0, Math.min(r.y, r.pageH));
  const w = Math.min(r.w - (x - r.x), r.pageW - x);
  const h = Math.min(r.h - (y - r.y), r.pageH - y);
  if (!(w >= 1) || !(h >= 1)) return null;
  return { x, y, w, h, pageW: r.pageW, pageH: r.pageH };
}

