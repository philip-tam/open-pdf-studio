// Mild unsharp mask on a freshly rendered RGBA page bitmap. PDFium draws small
// glyphs with soft, grey edges; a light 3x3 sharpen (src + amount * (src - blur))
// pulls the edge contrast and stroke darkness close to Acrobat's text, without
// touching flat areas. Alpha is left alone; the 1px border is not processed.

export const SHARPEN_LEVELS = [0, 0.3, 0.5, 0.8];

export function sharpenAmount(level) {
  return SHARPEN_LEVELS[level] ?? 0;
}

/** In place on RGBA bytes (Uint8ClampedArray). Returns the same array. */
export function sharpenRgba(rgba, w, h, amount) {
  if (!(amount > 0) || w < 3 || h < 3 || rgba.length < w * h * 4) return rgba;
  const s = new Uint8ClampedArray(rgba);
  const row = w * 4;
  for (let y = 1; y < h - 1; y++) {
    let i = y * row + 4;
    for (let x = 1; x < w - 1; x++, i += 4) {
      for (let c = 0; c < 3; c++) {
        const k = i + c;
        const blur = (
          s[k - row - 4] + 2 * s[k - row] + s[k - row + 4]
          + 2 * (s[k - 4] + 2 * s[k] + s[k + 4])
          + s[k + row - 4] + 2 * s[k + row] + s[k + row + 4]
        ) / 16;
        rgba[k] = s[k] + amount * (s[k] - blur);
      }
    }
  }
  return rgba;
}
