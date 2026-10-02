// Darkens the anti-aliased edge pixels of a rendered page so thin glyph
// strokes read black and crisp, like a stem-darkening text renderer. Pure
// per-channel gamma LUT: white (255) and black (0) are fixed points, so
// backgrounds and solid fills are untouched; only the grey in between moves.

export const TEXT_CONTRAST_LEVELS = [0, 1, 2, 3];
const GAMMA = [1, 1.25, 1.5, 1.8];

export function contrastGamma(level) {
  return GAMMA[level] ?? 1;
}

export function bouwContrastLut(level) {
  const g = contrastGamma(level);
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * Math.pow(i / 255, g));
  return lut;
}

/** In place on RGBA bytes; alpha is left alone. Returns the same array. */
export function pasContrastToe(rgba, level) {
  if (!level || !contrastGamma(level) || contrastGamma(level) === 1) return rgba;
  const lut = bouwContrastLut(level);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = lut[rgba[i]];
    rgba[i + 1] = lut[rgba[i + 1]];
    rgba[i + 2] = lut[rgba[i + 2]];
  }
  return rgba;
}
