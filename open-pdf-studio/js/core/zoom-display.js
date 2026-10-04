// The zoom shown to the user is relative to a screen resolution (dpi), like
// Acrobat's "Resolution" page-display setting: at 100% a PDF point (1/72 in)
// is drawn dpi/72 CSS pixels wide. 110 matches Acrobat's 100% on the
// author's 2560x1440 screen (measured); browsers use 96. Internally doc.scale / viewport.zoom stay
// in "CSS pixels per PDF point".
export const DEFAULT_ZOOM_DPI = 110;
export const MIN_ZOOM_DPI = 50;
export const MAX_ZOOM_DPI = 300;

let _dpi = DEFAULT_ZOOM_DPI;

export function normalizeZoomDpi(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ZOOM_DPI;
  return Math.min(MAX_ZOOM_DPI, Math.max(MIN_ZOOM_DPI, n));
}

export function setZoomDpi(value) {
  _dpi = normalizeZoomDpi(value);
}

export function getZoomDpi() {
  return _dpi;
}

/** CSS pixels per PDF point at 100%. */
export function cssPxPerPtAt100(dpi = _dpi) {
  return normalizeZoomDpi(dpi) / 72;
}

export function scaleToPercent(scale, dpi = _dpi) {
  return Math.round((scale / cssPxPerPtAt100(dpi)) * 100);
}

export function percentToScale(percent, dpi = _dpi) {
  return (percent / 100) * cssPxPerPtAt100(dpi);
}
