// De aanhaallijn van een tekstvak: een volle lijn of een stippellijn, met of
// zonder bolletje aan het eind (of een pijl). De lijn heeft de kleur van de
// rand van het vak. Puur: geen app-state, geen canvas; het scherm
// (rendering.js), de opgeslagen appearance (saver.js) en het paneel delen deze
// regels.

export const LEIDER_STIJLEN = Object.freeze(['arrow', 'line', 'lineDot', 'dotted', 'dottedDot']);

const STIJL_EIGENSCHAPPEN = Object.freeze({
  arrow: { endStyle: 'arrow', dotted: false },
  line: { endStyle: 'none', dotted: false },
  lineDot: { endStyle: 'circle', dotted: false },
  dotted: { endStyle: 'none', dotted: true },
  dottedDot: { endStyle: 'circle', dotted: true },
});

/** De stijl van de aanhaallijnen van een tekstvak; onbekend of leeg is de pijl (zoals voorheen). */
export function leiderStijlVan(ann) {
  return LEIDER_STIJLEN.includes(ann?.leaderLook) ? ann.leaderLook : 'arrow';
}

/** De eigenschappen van één leider voor een stijl: { endStyle, dotted }. */
export function leiderEigenschappen(stijl) {
  return { ...(STIJL_EIGENSCHAPPEN[stijl] || STIJL_EIGENSCHAPPEN.arrow) };
}

/** De stijl die bij een leider hoort (andersom), bijvoorbeeld na het openen van een bestand. */
export function stijlVanLeider(leider) {
  // Een oude staart (tekstballon) wordt een lijn met bolletje.
  const eind = leider?.endStyle === 'tail' ? 'circle' : (leider?.endStyle || 'arrow');
  const stippel = leider?.dotted === true;
  for (const [naam, e] of Object.entries(STIJL_EIGENSCHAPPEN)) {
    if (e.endStyle === eind && e.dotted === stippel) return naam;
  }
  return 'arrow';
}

/** De straal van het bolletje aan het eind, in punten. */
export function puntStraal(lijndikte) {
  return Math.max(3, (Number(lijndikte) || 1) * 1.8);
}

/** Het streeppatroon van een stippellijn (met ronde uiteinden): een punt en ruimte ervoor. */
export function stippelPatroon(lijndikte) {
  const lw = Number(lijndikte) || 1;
  return [0.01, Math.max(3, lw * 2.6)];
}

/**
 * Een eerste aanhaallijn voor een tekstvak dat er nog geen heeft: een rechte
 * lijn van het midden van de onderrand naar een punt onder het vak, links van
 * het midden. De knik ligt op de lijn, zodat hij recht blijft; het uiteinde
 * kan naar elk doel gesleept worden.
 */
export function standaardLeider(vak, stijl, id) {
  const b = vak.width || 150;
  const h = vak.height || 50;
  const ankerX = vak.x + b / 2;
  const ankerY = vak.y + h;
  const tipX = vak.x + b * 0.25;
  const tipY = vak.y + h + Math.max(40, h * 0.9);
  return {
    id: id || (Date.now().toString(36) + Math.random().toString(36).substr(2, 6)),
    tipX,
    tipY,
    kneeX: (ankerX + tipX) / 2,
    kneeY: (ankerY + tipY) / 2,
    ...leiderEigenschappen(stijl),
  };
}
