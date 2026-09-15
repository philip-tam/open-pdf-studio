// Page Dewarp: correct curved/warped scanned book pages (the sag near a
// book's gutter/spine that makes horizontal text lines bow instead of stay
// straight) by drawing a curved guide line and warping the page so that
// line becomes level.
//
// Unlike Straighten Page (deskew.js), this is NOT an affine transform — the
// PDF spec has no non-linear content-stream operator, so there is no way to
// "bend" real vector text/paths in place. The page is rasterized, warped as
// a bitmap, and re-embedded as a full-page image at the same page-tree
// position (mirrors deskew.js's embed/insertPage/removePage idiom, but with
// a rasterized image in place of a re-embedded vector page). See the Page
// Dewarp design report for the full rationale.
//
// Transform model: a single user-drawn curve measures vertical sag only
// (dx is always 0 — book-gutter warp bows a line up/down, it doesn't shear
// it sideways). For any point (x, y), the correction is the amount needed
// to bring the curve's height AT x up to the curve's own target height,
// scaled down the further y is from the curve (a triangular falloff over
// `influenceHeight`) — so the correction is strongest right at the guide
// line and fades out toward the page edges, rather than shearing the whole
// page uniformly.
import { getActiveDocument, getPageRotation } from "../core/state.js";
import { getCachedPdfBytes } from "./loader.js";
import { getCacheKey, reloadFromBytes } from "./page-manager.js";
import { canvasToBytes } from "./exporter.js";
import { recordPageStructure } from "../core/undo-manager.js";
import { showLoading, hideLoading } from "../ui/chrome/dialogs.js";
import { cloneAnnotation } from "../annotations/factory.js";
import { buildDewarpField } from "./dewarp-geometry.js";
import { PDFDocument } from "pdf-lib";

export { buildDewarpField };

const DEFAULT_DPI = 300;
const DEFAULT_TILE_PX = 6;
const DEFAULT_OVERLAP_PX = 2;

/**
 * Warp a rasterized page canvas by translating small tiles vertically per
 * the displacement field — no shear, no WebGL, no per-pixel loop: just many
 * cheap `drawImage` calls, composited by the browser. Tiles are drawn with a
 * small source/dest overlap so adjacent tiles (whose displacement differs
 * slightly) don't leave hairline gaps between them.
 *
 * `field` is evaluated in point space; `scale` (pixels per point, i.e.
 * dpi/72) converts tile-center pixel coordinates to that space and the
 * resulting displacement back to pixels.
 */
export function warpCanvasVertical(sourceCanvas, field, scale, tileSize = DEFAULT_TILE_PX, overlap = DEFAULT_OVERLAP_PX) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  // White fill so a tile that moves away from a spot (rather than another
  // tile moving into it) exposes page-background white, not transparency.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  for (let ty = 0; ty < h; ty += tileSize) {
    const tileH = Math.min(tileSize, h - ty);
    for (let tx = 0; tx < w; tx += tileSize) {
      const tileW = Math.min(tileSize, w - tx);
      const cxPx = tx + tileW / 2;
      const cyPx = ty + tileH / 2;
      const dyPt = field.displacementAt(cxPx / scale, cyPx / scale);
      const dyPx = dyPt * scale;

      const srcX = Math.max(0, tx - overlap);
      const srcEndX = Math.min(w, tx + tileW + overlap);
      const srcY = Math.max(0, ty - overlap);
      const srcEndY = Math.min(h, ty + tileH + overlap);
      const srcW = srcEndX - srcX;
      const srcH = srcEndY - srcY;
      if (srcW <= 0 || srcH <= 0) continue;

      ctx.drawImage(sourceCanvas, srcX, srcY, srcW, srcH, srcX, srcY + dyPx, srcW, srcH);
    }
  }
  return out;
}

// Rasterize just the PDF content layer (no annotations baked in — unlike
// exporter.js's renderPageOffscreen) at the given scale. Annotations stay
// live objects and get their own coordinates warped by warpAnnotation()
// below, the same division of labor deskew.js uses for rotation.
async function renderPageContentOnly(pageNum, scale) {
  const page = await getActiveDocument().pdfDoc.getPage(pageNum);
  const extraRotation = getPageRotation(pageNum);
  const viewportOpts = { scale };
  if (extraRotation) {
    viewportOpts.rotation = (page.rotate + extraRotation) % 360;
  }
  const viewport = page.getViewport(viewportOpts);

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport, annotationMode: 0 }).promise;
  return canvas;
}

/**
 * Warp one annotation's position-bearing fields by the field's vertical
 * displacement (dx is always 0 — see the module doc comment). Mirrors
 * deskew.js's rotateAnnotationAround for the same set of fields, but a
 * translation instead of a rotation; a box-shaped annotation's own
 * width/height is left alone (warping its outline into a non-rectangular
 * shape is out of scope for this MVP — only its anchor moves).
 */
function warpAnnotation(ann, field) {
  const warp = (x, y) => ({ x, y: y + field.displacementAt(x, y) });
  const warpXY = (obj, xKey, yKey) => {
    if (obj[xKey] === undefined) return;
    const p = warp(obj[xKey], obj[yKey]);
    obj[xKey] = p.x;
    obj[yKey] = p.y;
  };
  warpXY(ann, "x", "y");
  warpXY(ann, "startX", "startY");
  warpXY(ann, "endX", "endY");
  warpXY(ann, "arrowX", "arrowY");
  warpXY(ann, "kneeX", "kneeY");
  if (Array.isArray(ann.path)) {
    ann.path = ann.path.map((p) => warp(p.x, p.y));
  }
  if (Array.isArray(ann.points)) {
    ann.points = ann.points.map((p) => warp(p.x, p.y));
  }
}

// Shared rasterize+warp step used by both the dialog's preview and the real
// apply — guarantees the preview shows exactly what Apply will produce.
async function computeWarpedCanvas(pageNum, points, options) {
  const dpi = options.dpi || DEFAULT_DPI;
  const scale = dpi / 72;
  const sourceCanvas = await renderPageContentOnly(pageNum, scale);
  const influenceHeight = options.influenceHeight ?? sourceCanvas.height / scale;
  const field = buildDewarpField(points, influenceHeight);
  if (!field) return null;
  const warpedCanvas = warpCanvasVertical(sourceCanvas, field, scale);
  return { warpedCanvas, field, scale };
}

/**
 * Rasterize and warp the current page WITHOUT committing anything — for the
 * confirm dialog's preview. Returns the warped canvas directly so it can be
 * drawn into a preview `<canvas>`.
 * @param {{x:number,y:number}[]} points
 * @param {Object} [options] - see dewarpPage's options.
 * @returns {Promise<HTMLCanvasElement | null>}
 */
export async function renderDewarpPreview(points, options = {}) {
  const doc = getActiveDocument();
  if (!doc?.pdfDoc) return null;
  if (!points || points.length < 3) return null;
  const result = await computeWarpedCanvas(doc.currentPage, points, options);
  return result ? result.warpedCanvas : null;
}

/**
 * Dewarp the current page: rasterize it, warp the raster by the field
 * derived from the user's guide curve, and swap it in as a full-page image
 * at the same page-tree position. Current page only — there's deliberately
 * no "apply to all pages" here (unlike Straighten's constant rotation, a
 * book's gutter-warp shape differs page to page).
 *
 * @param {{x:number,y:number}[]} points - guide-curve points, APP space, on
 *   the current page.
 * @param {Object} [options]
 * @param {number} [options.dpi=300] - rasterize resolution.
 * @param {'png'|'jpeg'} [options.format='png'] - lossless by default, since
 *   this operation's whole point is fidelity, not size (contrast
 *   compress.js's deliberately-lossy JPEG default).
 * @param {number} [options.quality=0.92] - only used when format is 'jpeg'.
 * @param {number} [options.influenceHeight] - defaults to the full page
 *   height (in points), so the correction reaches from the guide line all
 *   the way to the top/bottom edges.
 * @returns {Promise<{warped: boolean}>}
 */
export async function dewarpPage(points, options = {}) {
  const doc = getActiveDocument();
  if (!doc?.pdfDoc) return { warped: false };
  if (!points || points.length < 3) return { warped: false };

  const cacheKey = getCacheKey();
  const currentBytes = getCachedPdfBytes(cacheKey);
  if (!currentBytes) return { warped: false };

  const pageNum = doc.currentPage;
  const format = options.format === "jpeg" ? "jpeg" : "png";
  const quality = options.quality ?? 0.92;

  const oldAnnotations = doc.annotations.map((a) => cloneAnnotation(a));
  const oldRotations = { ...doc.pageRotations };
  const oldPage = doc.currentPage;

  showLoading("Dewarping page...");
  try {
    const result = await computeWarpedCanvas(pageNum, points, options);
    if (!result) return { warped: false };
    const { warpedCanvas, field } = result;
    const bytes = await canvasToBytes(warpedCanvas, format, quality);

    const pdfDoc = await PDFDocument.load(currentBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const pageIndex = pageNum - 1;
    const { width, height } = pages[pageIndex].getSize();

    const image = format === "jpeg" ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes);
    const newPage = pdfDoc.insertPage(pageIndex, [width, height]);
    pdfDoc.removePage(pageIndex + 1);
    newPage.drawImage(image, { x: 0, y: 0, width, height });

    const newAnnotations = doc.annotations.map((a) => cloneAnnotation(a));
    for (const ann of newAnnotations) {
      if (ann.page === pageNum) warpAnnotation(ann, field);
    }

    const newBytes = new Uint8Array(await pdfDoc.save());
    const newRotations = { ...oldRotations };

    await reloadFromBytes(newBytes, newAnnotations, newRotations, pageNum);
    recordPageStructure(
      currentBytes,
      oldAnnotations,
      oldRotations,
      oldPage,
      newBytes,
      newAnnotations,
      newRotations,
      pageNum
    );

    return { warped: true };
  } finally {
    hideLoading();
  }
}
