// Een tekstballon: een tekstvak met een staartvormige aanhaallijn. De punt van
// de staart is het uiteinde van een leider dat je naar elk doel kunt slepen; de
// staart hangt op de plek van de rand die naar die punt wijst, aan elke kant.
//
// Puur: geen app-state, geen canvas. Het scherm (rendering.js) en de opgeslagen
// appearance (saver.js) gebruiken dezelfde meetkunde.

import { hoekStraal } from './textbox-vorm.js';

const MIN_VOET = 4;
const MAX_VOET = 16;

/** De halve breedte van de voet van een staart bij een vak, in punten. */
export function halveVoet(breedte, hoogte) {
  return Math.max(MIN_VOET, Math.min(MAX_VOET, Math.min(breedte, hoogte) * 0.14));
}

/**
 * De twee voetpunten van een staart op de rand van het vak, naar de punt toe.
 * null als de punt binnen het vak ligt (dan is er geen staart te tekenen).
 * @param {{x:number, y:number, width:number, height:number}} vak linksboven + maat
 * @param {'rect'|'rounded'|'ellipse'} vorm
 * @param {{x:number, y:number}} punt
 * @returns {{p1:{x:number,y:number}, p2:{x:number,y:number}, basis:{x:number,y:number}}|null}
 */
export function staartVoet(vak, vorm, punt) {
  const b = vak.width || 150;
  const h = vak.height || 50;
  const cx = vak.x + b / 2;
  const cy = vak.y + h / 2;
  const dx = punt.x - cx;
  const dy = punt.y - cy;
  const halve = halveVoet(b, h);

  if (vorm === 'ellipse') {
    const rx = b / 2, ry = h / 2;
    const u = dx / rx, v = dy / ry;
    if (u * u + v * v <= 1) return null;
    const hoek = Math.atan2(v, u);
    const delta = halve / ((rx + ry) / 2);
    const opRand = (a) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    return { p1: opRand(hoek - delta), p2: opRand(hoek + delta), basis: opRand(hoek) };
  }

  if (Math.abs(dx) <= b / 2 && Math.abs(dy) <= h / 2) return null;
  // De straal vanuit het midden naar de punt raakt de rand van de rechthoek.
  const tx = dx === 0 ? Infinity : (b / 2) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (h / 2) / Math.abs(dy);
  const t = Math.min(tx, ty);
  const bx = cx + dx * t;
  const by = cy + dy * t;
  const r = vorm === 'rounded' ? hoekStraal(b, h) : 0;
  const klem = (w, min, max) => Math.max(min, Math.min(max, w));
  if (tx < ty) {
    // Linker- of rechterrand: de voet loopt verticaal, weg van de hoeken.
    const m = Math.min(r + halve, h / 2);
    const y = klem(by, vak.y + m, vak.y + h - m);
    return { p1: { x: bx, y: y - halve }, p2: { x: bx, y: y + halve }, basis: { x: bx, y } };
  }
  const m = Math.min(r + halve, b / 2);
  const x = klem(bx, vak.x + m, vak.x + b - m);
  return { p1: { x: x - halve, y: by }, p2: { x: x + halve, y: by }, basis: { x, y: by } };
}

/** De omhullende van een staart: [minX, minY, maxX, maxY], met halve lijndikte marge. */
export function staartOmhullende(voet, punt, lijndikte = 0) {
  const m = (lijndikte || 0) / 2 + 1;
  const xs = [voet.p1.x, voet.p2.x, punt.x];
  const ys = [voet.p1.y, voet.p2.y, punt.y];
  return [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m];
}

/**
 * Een eerste staart voor een tekstvak dat er nog geen heeft: de punt hangt
 * onder het vak, links van het midden, zodat hij meteen te zien is en naar elk
 * doel versleept kan worden.
 */
export function standaardStaart(vak, id) {
  const b = vak.width || 150;
  const h = vak.height || 50;
  const tipX = vak.x + b * 0.25;
  const tipY = vak.y + h + Math.max(24, h * 0.6);
  return {
    id: id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
    tipX,
    tipY,
    kneeX: tipX,
    kneeY: vak.y + h + Math.max(12, h * 0.3),
    endStyle: 'tail',
  };
}
