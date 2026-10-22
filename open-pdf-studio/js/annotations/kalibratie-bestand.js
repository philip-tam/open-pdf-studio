// De kalibratie van een PDF als zijbestand naast de PDF zelf: "Plan.pdf" krijgt
// "Plan.pdf.calibration.json" in dezelfde map. Zo onthoudt het plan zijn schaal
// (ook per as, schaal-xy.js) op elke computer en na het wissen van de
// browseropslag, en reist de schaal mee met het bestand. Dezelfde keuze als het
// leespositie-zijbestand van Reader Mode (core/reader-mode.js): geen centrale
// lijst van alle geopende bestanden.
//
// Alleen een door de gebruiker gemaakte schaal komt in het zijbestand (kalibratie
// per as, referentielijn, snelle schaal, schaalverhouding); een automatisch uit
// de titelhoek gelezen schaal niet, zodat het openen van een PDF geen bestand
// naast die PDF achterlaat.

import { isTauri, readBinaryFile, writeBinaryFile } from '../core/platform.js';

export const KALIBRATIE_ACHTERVOEGSEL = '.calibration.json';
const VERSIE = 1;

/** Schaalmethoden die de gebruiker zelf instelt en dus bewaard worden. */
const BEWAARDE_METHODEN = new Set(['calibrate-xy', 'reference', 'quick-scale', 'ratio']);

export function kalibratiePad(bestandspad) {
  return bestandspad + KALIBRATIE_ACHTERVOEGSEL;
}

/** Hoort deze documentschaal in het zijbestand? */
export function isBewaardeSchaal(schaal) {
  return !!schaal && BEWAARDE_METHODEN.has(schaal.method) && schaal.pixelsPerUnit > 0;
}

/**
 * De schaal uit de inhoud van een zijbestand, of null als die niet klopt.
 * Alleen bekende velden komen mee: een bestand van buitenaf zet geen eigen
 * sleutels in de documentstatus.
 */
export function leesKalibratieInhoud(inhoud) {
  let data = inhoud;
  if (typeof inhoud === 'string') {
    try { data = JSON.parse(inhoud); } catch { return null; }
  }
  const s = data?.measureScale;
  const x = Number(s?.pixelsPerUnit);
  if (!(x > 0) || !Number.isFinite(x) || typeof s?.unit !== 'string' || !s.unit) return null;
  const uit = { pixelsPerUnit: x, unit: s.unit, method: typeof s.method === 'string' ? s.method : 'reference', scaleRatio: s.scaleRatio ?? 0 };
  const y = Number(s.pixelsPerUnitY);
  if (y > 0 && Number.isFinite(y)) uit.pixelsPerUnitY = y;
  return uit;
}

/** De inhoud van het zijbestand voor een schaal. */
export function maakKalibratieInhoud(schaal) {
  return JSON.stringify({ version: VERSIE, savedAt: new Date().toISOString(), measureScale: schaal }, null, 2);
}

/** Leest het zijbestand van een PDF; null als er geen (geldig) is. Alleen in de desktop-app. */
export async function leesKalibratieBestand(bestandspad) {
  if (!bestandspad || !isTauri()) return null;
  try {
    const bytes = await readBinaryFile(kalibratiePad(bestandspad));
    if (!bytes || bytes.length === 0) return null;
    return leesKalibratieInhoud(new TextDecoder().decode(bytes));
  } catch {
    return null; // er is (nog) geen zijbestand
  }
}

/** Schrijft het zijbestand; false als dat niet lukte (bijvoorbeeld een map die alleen leesbaar is). */
export async function schrijfKalibratieBestand(bestandspad, schaal) {
  if (!bestandspad || !isTauri()) return false;
  try {
    await writeBinaryFile(kalibratiePad(bestandspad), new TextEncoder().encode(maakKalibratieInhoud(schaal)));
    return true;
  } catch (e) {
    console.warn('Could not write the calibration file:', e);
    return false;
  }
}

/** Verwijdert het zijbestand (als de schaal gewist is). */
export async function verwijderKalibratieBestand(bestandspad) {
  if (!bestandspad || !isTauri()) return true;
  const fs = window.__TAURI__?.fs;
  const doel = kalibratiePad(bestandspad);
  try {
    if (fs?.exists && !(await fs.exists(doel))) return true;
    await fs.remove(doel);
    return true;
  } catch (e) {
    console.warn('Could not remove the calibration file:', e);
    return false;
  }
}
