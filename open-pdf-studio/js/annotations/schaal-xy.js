// Schaal per as: een oud plan waarvan de horizontale en de verticale schaal
// niet gelijk zijn (bijvoorbeeld een gescand plan dat in één richting is
// uitgerekt). De documentschaal (doc.measureScale) heeft dan naast
// pixelsPerUnit (de x-as) ook pixelsPerUnitY. Zonder pixelsPerUnitY is de
// schaal voor beide assen gelijk, zoals altijd.
//
// Puur: geen app-state, geen DOM. measurement.js rekent hiermee lengtes,
// omtrekken, oppervlakten en hoeken; de kalibratietool bouwt de schaal.

import { eenheidFactor } from './vlak-zijden.js';
import { leesGetal } from '../core/getal-invoer.js';

const GELIJK_TOLERANTIE = 1e-3;

/** Punten per eenheid langs de y-as; zonder aparte y-schaal gelijk aan die van x. */
export function pixelsPerUnitY(schaal) {
  const y = Number(schaal?.pixelsPerUnitY);
  return y > 0 ? y : Number(schaal?.pixelsPerUnit);
}

/** Verschillen de x- en y-schaal? */
export function isAnisotroop(schaal) {
  const y = Number(schaal?.pixelsPerUnitY);
  const x = Number(schaal?.pixelsPerUnit);
  return y > 0 && x > 0 && Math.abs(y - x) / x > GELIJK_TOLERANTIE;
}

/** De echte lengte (in schaaleenheden) van een verschuiving (dx, dy) in punten. */
export function lengteInEenheden(dx, dy, schaal) {
  const x = Number(schaal.pixelsPerUnit);
  const y = pixelsPerUnitY(schaal);
  return Math.sqrt((dx / x) ** 2 + (dy / y) ** 2);
}

/** De echte lengte van een reeks punten (omtrek van een open of gesloten lijn). */
export function omtrekInEenheden(punten, schaal) {
  let totaal = 0;
  for (let i = 0; i < punten.length - 1; i++) {
    totaal += lengteInEenheden(punten[i + 1].x - punten[i].x, punten[i + 1].y - punten[i].y, schaal);
  }
  return totaal;
}

/** Een oppervlak in punten² omgerekend naar eenheden² met beide assen. */
export function oppervlakInEenheden(oppervlakPunten, schaal) {
  return oppervlakPunten / (Number(schaal.pixelsPerUnit) * pixelsPerUnitY(schaal));
}

/**
 * De hoek bij `hoekpunt` in graden (0-180), gemeten in de echte maten: elke
 * as wordt eerst met zijn eigen schaal omgerekend, anders klopt de hoek niet
 * als de assen verschillend zijn.
 */
export function hoekInGraden(punt1, hoekpunt, punt2, schaal) {
  const x = Number(schaal?.pixelsPerUnit) > 0 ? Number(schaal.pixelsPerUnit) : 1;
  const y = schaal ? pixelsPerUnitY(schaal) || 1 : 1;
  const a1 = Math.atan2((punt1.y - hoekpunt.y) / y, (punt1.x - hoekpunt.x) / x);
  const a2 = Math.atan2((punt2.y - hoekpunt.y) / y, (punt2.x - hoekpunt.x) / x);
  let graden = (a2 - a1) * (180 / Math.PI);
  if (graden < 0) graden += 360;
  if (graden > 180) graden = 360 - graden;
  return graden;
}

/** Op welke as ligt een getraceerde lijn: de langste richting wint. */
export function dominanteAs(dx, dy) {
  return Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
}

/** De lengte van een getraceerde lijn langs een as (de projectie, niet de schuine lengte). */
export function lengteLangsAs(dx, dy, as) {
  return as === 'x' ? Math.abs(dx) : Math.abs(dy);
}

/** Voet en inch naar voet (de schaaleenheid blijft ft). */
export function voetInchNaarVoet(voet, inch) {
  const v = Number(voet) || 0;
  const i = Number(inch) || 0;
  return v + i / 12;
}

/**
 * Een lengte als tekst lezen: "12,5 m", "350 cm", "5'6\\"", "5 ft 6 in", "5' 6".
 * Geeft { waarde, eenheid } of null. Komma of punt als decimaalteken.
 */
export function leesLengte(tekst, standaardEenheid = 'm') {
  // Typografische aanhalingstekens (een toetsenbord of tekstverwerker maakt van
  // 5'6" vaak 5\u20196\u201D) tellen als voet en inch.
  const t = String(tekst ?? '').trim().toLowerCase()
    .replace(/[\u2018\u2019\u201B\u2032\u02BC\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033\u02BA]|''/g, '"');
  if (!t) return null;
  const getal = '(\\d[\\d.,]*)';
  // Inch met een breuk, zoals op een plan: 2 1/2, 2\u00BD of 1/2.
  const inchGetal = '(\\d[\\d.,]*(?:\\s*[\u00BC\u00BD\u00BE\u2153\u2154\u215B\u215C\u215D\u215E])?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+)';
  const voetInch = t.match(new RegExp(`^${getal}\\s*(?:'|ft|feet|foot)\\s*(?:${inchGetal}\\s*(?:"|in|inch|inches)?)?$`));
  if (voetInch) {
    const voet = leesGetal(voetInch[1]);
    const inch = voetInch[2] === undefined ? 0 : leesInch(voetInch[2]);
    if (!(voet >= 0) || !(inch >= 0)) return null;
    const waarde = voetInchNaarVoet(voet, inch);
    return waarde > 0 ? { waarde, eenheid: 'ft' } : null;
  }
  const gewoon = t.match(new RegExp(`^${getal}\\s*(mm|cm|dm|m|km|in|"|ft|yd)?$`));
  if (!gewoon) return null;
  const waarde = leesGetal(gewoon[1]);
  if (!(waarde > 0)) return null;
  return { waarde, eenheid: gewoon[2] === '"' ? 'in' : (gewoon[2] || standaardEenheid) };
}

const BREUK_TEKEN = { '\u00BC': 0.25, '\u00BD': 0.5, '\u00BE': 0.75, '\u2153': 1 / 3, '\u2154': 2 / 3, '\u215B': 0.125, '\u215C': 0.375, '\u215D': 0.625, '\u215E': 0.875 };

/** Een inchmaat met een breuk: "2", "2.5", "2 1/2", "2\u00BD", "1/2". NaN als het niet klopt. */
function leesInch(tekst) {
  let rest = String(tekst).trim();
  let totaal = 0;
  const teken = rest.match(/[\u00BC\u00BD\u00BE\u2153\u2154\u215B\u215C\u215D\u215E]$/);
  if (teken) {
    totaal += BREUK_TEKEN[teken[0]];
    rest = rest.slice(0, -1).trim();
  }
  const breuk = rest.match(/(?:^|\s)(\d+)\/(\d+)$/);
  if (breuk) {
    const noemer = Number(breuk[2]);
    if (!(noemer > 0)) return NaN;
    totaal += Number(breuk[1]) / noemer;
    rest = rest.slice(0, breuk.index).trim();
  }
  if (rest) totaal += leesGetal(rest);
  return totaal;
}

/**
 * De documentschaal uit één of twee getraceerde maten.
 * @param {{ x?: {punten:number, waarde:number, eenheid:string}, y?: {punten:number, waarde:number, eenheid:string} }} m
 *   punten = lengte van de trace langs de as in PDF-punten; waarde + eenheid = de echte maat.
 * @returns {{pixelsPerUnit:number, pixelsPerUnitY?:number, unit:string, method:string, scaleRatio:number}|null}
 */
export function schaalUitAssen({ x, y }) {
  const geldig = (m) => m && m.punten > 0 && m.waarde > 0 && m.eenheid;
  const gx = geldig(x) ? x : null;
  const gy = geldig(y) ? y : null;
  if (!gx && !gy) return null;
  const eerste = gx || gy;
  const eenheid = eerste.eenheid;
  const ppu = (m) => {
    const factor = m.eenheid === eenheid ? 1 : eenheidFactor(m.eenheid, eenheid);
    if (!factor) return null;
    return m.punten / (m.waarde * factor);
  };
  const px = gx ? ppu(gx) : null;
  const py = gy ? ppu(gy) : null;
  if ((gx && !px) || (gy && !py)) return null;
  const basis = { unit: eenheid, method: 'calibrate-xy', scaleRatio: 0 };
  if (px && py) {
    if (Math.abs(py - px) / px <= GELIJK_TOLERANTIE) return { pixelsPerUnit: px, ...basis };
    return { pixelsPerUnit: px, pixelsPerUnitY: py, ...basis };
  }
  return { pixelsPerUnit: px || py, ...basis };
}
