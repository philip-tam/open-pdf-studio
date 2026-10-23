// De vorm van een tekstvak: rechthoek met scherpe hoeken, rechthoek met
// afgeronde hoeken of ellips (een cirkel bij een vierkant vak). Een vak met
// vulkleur en lichte tekst (paars met wit, bijvoorbeeld) is zo ook een
// afgeronde knop of een ovaal.
//
// Puur: geen app-state. Het canvas (rendering.js), de opgeslagen appearance
// (saver.js) en de tekstinzet (textbox-layout.js) gebruiken dezelfde regels.

export const TEKSTVAK_VORMEN = Object.freeze(['rect', 'rounded', 'ellipse', 'speech', 'speechEllipse']);

// Tekstballon: een afgerond of ovaal lichaam met een staart. De staart ligt
// BINNEN het vak (het lichaam is de rest van de hoogte), zodat de rand van het
// vak ook de staart omvat: selectie, /Rect en de appearance blijven kloppen.
export const STAART_ZIJDEN = Object.freeze(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
const LICHAAM_FRACTIE = 0.78;

// Kwart van de korte zijde per hoek; een vak van 150 x 50 krijgt zo 10 pt.
const HOEK_FRACTIE = 0.2;
// 1 - cos(45 graden): hoeveel van een afrondingsstraal de tekst vrij moet blijven.
const HOEK_VRIJ = 1 - Math.SQRT1_2;
const BEZIER_K = 0.5522847498;

/** De vorm van een annotatie; onbekend of leeg is een rechthoek. */
export function vormVan(ann) {
  return TEKSTVAK_VORMEN.includes(ann?.boxShape) ? ann.boxShape : 'rect';
}

/** Is dit een tekstballon (lichaam met staart)? */
export function isBallon(vorm) {
  return vorm === 'speech' || vorm === 'speechEllipse';
}

/** Aan welke kant en hoek de staart zit; standaard linksonder. */
export function staartVan(ann) {
  return STAART_ZIJDEN.includes(ann?.tailSide) ? ann.tailSide : 'bottom-left';
}

/**
 * De ruimte boven en onder die de staart inneemt (tekst staat in het lichaam).
 * Alleen een ballon heeft die; andere vormen 0.
 */
export function vormZones(ann) {
  if (!isBallon(vormVan(ann))) return { boven: 0, onder: 0 };
  const h = ann?.height || 50;
  const staart = h * (1 - LICHAAM_FRACTIE);
  return staartVan(ann).startsWith('top') ? { boven: staart, onder: 0 } : { boven: 0, onder: staart };
}

/** De straal van de afgeronde hoeken van een vak, in paginapunten. */
export function hoekStraal(breedte, hoogte) {
  return Math.max(0, Math.min(breedte, hoogte) * HOEK_FRACTIE);
}

/**
 * Hoeveel de tekst extra van de rand blijft in een afgeronde of ovale vorm,
 * zodat hij binnen de contour past. Eén waarde voor alle zijden (de
 * tekstinzet is overal gelijk): bij een ellips de inzet van de ingeschreven
 * rechthoek langs de korte zijde.
 */
export function vormInzet(ann) {
  const vorm = vormVan(ann);
  if (vorm === 'rect') return 0;
  const b = ann?.width || 150;
  const h = ann?.height || 50;
  if (vorm === 'rounded') return hoekStraal(b, h) * HOEK_VRIJ;
  if (vorm === 'speech') return hoekStraal(b, h * LICHAAM_FRACTIE) * HOEK_VRIJ;
  if (vorm === 'speechEllipse') return (Math.min(b, h * LICHAAM_FRACTIE) / 2) * HOEK_VRIJ;
  return (Math.min(b, h) / 2) * HOEK_VRIJ;
}


// ── Tekstballon: het pad als lijst van opdrachten ─────────────────────────
// In vak-ruimte (0,0 linksboven, y omlaag); canvas en PDF zetten ze om.
// Opdrachten: ['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y], ['Z'].

function boogNaarBeziers(cx, cy, rx, ry, van, tot, uit) {
  const stukken = Math.max(1, Math.ceil(Math.abs(tot - van) / (Math.PI / 2) - 1e-9));
  const stap = (tot - van) / stukken;
  const k = (4 / 3) * Math.tan(stap / 4);
  for (let i = 0; i < stukken; i++) {
    const a0 = van + i * stap;
    const a1 = a0 + stap;
    const x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
    const x3 = cx + rx * Math.cos(a1), y3 = cy + ry * Math.sin(a1);
    uit.push(['C',
      x0 - k * rx * Math.sin(a0), y0 + k * ry * Math.cos(a0),
      x3 + k * rx * Math.sin(a1), y3 - k * ry * Math.cos(a1),
      x3, y3]);
  }
}

function ballonOpdrachten(b, h, vorm) {
  // Gebouwd met de staart linksonder; de andere hoeken spiegelen daarna.
  const lh = h * LICHAAM_FRACTIE;
  const ops = [];
  if (vorm === 'speech') {
    const r = hoekStraal(b, lh);
    const k = r * BEZIER_K;
    const staartLinks = Math.max(r, b * 0.16);
    const staartRechts = staartLinks + Math.max(6, b * 0.14);
    const punt = Math.max(0, b * 0.06);
    ops.push(['M', r, 0]);
    ops.push(['L', b - r, 0]);
    ops.push(['C', b - r + k, 0, b, r - k, b, r]);
    ops.push(['L', b, lh - r]);
    ops.push(['C', b, lh - r + k, b - r + k, lh, b - r, lh]);
    ops.push(['L', staartRechts, lh]);
    ops.push(['L', punt, h]);
    ops.push(['L', staartLinks, lh]);
    ops.push(['L', r, lh]);
    ops.push(['C', r - k, lh, 0, lh - r + k, 0, lh - r]);
    ops.push(['L', 0, r]);
    ops.push(['C', 0, r - k, r - k, 0, r, 0]);
    ops.push(['Z']);
    return ops;
  }
  // Ovaal lichaam: de staart hangt aan de onderkant, links van het midden.
  const cx = b / 2, cy = lh / 2, rx = b / 2, ry = lh / 2;
  const hoek1 = (100 * Math.PI) / 180; // dichter bij het midden
  const hoek2 = (135 * Math.PI) / 180;
  const p1 = [cx + rx * Math.cos(hoek1), cy + ry * Math.sin(hoek1)];
  const p2 = [cx + rx * Math.cos(hoek2), cy + ry * Math.sin(hoek2)];
  ops.push(['M', p1[0], p1[1]]);
  ops.push(['L', b * 0.1, h]);
  ops.push(['L', p2[0], p2[1]]);
  boogNaarBeziers(cx, cy, rx, ry, hoek2, hoek1 + 2 * Math.PI, ops);
  ops.push(['Z']);
  return ops;
}

/** De opdrachten van een ballonpad in vak-ruimte, met de staart aan de gekozen kant. */
export function vakPadOpdrachten(breedte, hoogte, vorm, staart = 'bottom-left') {
  const ops = ballonOpdrachten(breedte, hoogte, vorm);
  const spiegelX = staart.endsWith('right');
  const spiegelY = staart.startsWith('top');
  if (!spiegelX && !spiegelY) return ops;
  const mx = (x) => (spiegelX ? breedte - x : x);
  const my = (y) => (spiegelY ? hoogte - y : y);
  return ops.map(([op, ...p]) => {
    const uit = [op];
    for (let i = 0; i < p.length; i += 2) uit.push(mx(p[i]), my(p[i + 1]));
    return uit;
  });
}

/**
 * Het pad van een vak op een canvas (nog niet gevuld of getekend).
 * @param {CanvasRenderingContext2D} ctx
 */
export function bouwVakPad(ctx, x, y, breedte, hoogte, vorm, staart) {
  ctx.beginPath();
  if (isBallon(vorm)) {
    for (const [op, ...p] of vakPadOpdrachten(breedte, hoogte, vorm, staart)) {
      if (op === 'M') ctx.moveTo(x + p[0], y + p[1]);
      else if (op === 'L') ctx.lineTo(x + p[0], y + p[1]);
      else if (op === 'C') ctx.bezierCurveTo(x + p[0], y + p[1], x + p[2], y + p[3], x + p[4], y + p[5]);
      else ctx.closePath();
    }
  } else if (vorm === 'ellipse') {
    ctx.ellipse(x + breedte / 2, y + hoogte / 2, breedte / 2, hoogte / 2, 0, 0, Math.PI * 2);
  } else if (vorm === 'rounded') {
    ctx.roundRect(x, y, breedte, hoogte, hoekStraal(breedte, hoogte));
  } else {
    ctx.rect(x, y, breedte, hoogte);
  }
}

const getal = (n) => String(Math.round(n * 1e4) / 1e4);

/**
 * Het pad van een vak als PDF-operatoren (y omhoog, het pad is gesloten maar
 * nog niet gevuld of getekend). x, y is de linkeronderhoek.
 */
export function vakPadPdf(x, y, breedte, hoogte, vorm, staart) {
  if (isBallon(vorm)) {
    // y omhoog: de vak-ruimte (y omlaag) wordt omgeklapt rond de hoogte.
    const pt = (px, py) => `${getal(x + px)} ${getal(y + hoogte - py)}`;
    return vakPadOpdrachten(breedte, hoogte, vorm, staart).map(([op, ...p]) => {
      if (op === 'M') return `${pt(p[0], p[1])} m`;
      if (op === 'L') return `${pt(p[0], p[1])} l`;
      if (op === 'C') return `${pt(p[0], p[1])} ${pt(p[2], p[3])} ${pt(p[4], p[5])} c`;
      return 'h';
    }).join('\n');
  }
  if (vorm === 'ellipse') {
    const rx = breedte / 2;
    const ry = hoogte / 2;
    const cx = x + rx;
    const cy = y + ry;
    const kx = rx * BEZIER_K;
    const ky = ry * BEZIER_K;
    return [
      `${getal(cx + rx)} ${getal(cy)} m`,
      `${getal(cx + rx)} ${getal(cy + ky)} ${getal(cx + kx)} ${getal(cy + ry)} ${getal(cx)} ${getal(cy + ry)} c`,
      `${getal(cx - kx)} ${getal(cy + ry)} ${getal(cx - rx)} ${getal(cy + ky)} ${getal(cx - rx)} ${getal(cy)} c`,
      `${getal(cx - rx)} ${getal(cy - ky)} ${getal(cx - kx)} ${getal(cy - ry)} ${getal(cx)} ${getal(cy - ry)} c`,
      `${getal(cx + kx)} ${getal(cy - ry)} ${getal(cx + rx)} ${getal(cy - ky)} ${getal(cx + rx)} ${getal(cy)} c`,
      'h',
    ].join('\n');
  }
  if (vorm === 'rounded') {
    const r = hoekStraal(breedte, hoogte);
    const k = r * BEZIER_K;
    const x2 = x + breedte;
    const y2 = y + hoogte;
    return [
      `${getal(x + r)} ${getal(y)} m`,
      `${getal(x2 - r)} ${getal(y)} l`,
      `${getal(x2 - r + k)} ${getal(y)} ${getal(x2)} ${getal(y + r - k)} ${getal(x2)} ${getal(y + r)} c`,
      `${getal(x2)} ${getal(y2 - r)} l`,
      `${getal(x2)} ${getal(y2 - r + k)} ${getal(x2 - r + k)} ${getal(y2)} ${getal(x2 - r)} ${getal(y2)} c`,
      `${getal(x + r)} ${getal(y2)} l`,
      `${getal(x + r - k)} ${getal(y2)} ${getal(x)} ${getal(y2 - r + k)} ${getal(x)} ${getal(y2 - r)} c`,
      `${getal(x)} ${getal(y + r)} l`,
      `${getal(x)} ${getal(y + r - k)} ${getal(x + r - k)} ${getal(y)} ${getal(x + r)} ${getal(y)} c`,
      'h',
    ].join('\n');
  }
  // Ongewijzigd: de maten van een rechthoek komen nauwkeurig in de appearance.
  return `${x} ${y} ${breedte} ${hoogte} re`;
}
