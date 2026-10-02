import { state } from '../core/state.js';
import { pasContrastToe } from './text-contrast.js';

export function tekstContrastNiveau() {
  const n = Number(state.preferences && state.preferences.textContrast);
  return Number.isInteger(n) ? n : 0;
}

/** Applies the user's text-contrast level to freshly rendered RGBA, in place. */
export function pasTekstContrastToe(rgba) {
  return pasContrastToe(rgba, tekstContrastNiveau());
}
