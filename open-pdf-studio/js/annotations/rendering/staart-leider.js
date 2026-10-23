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
    const norm = ((hoek % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return { p1: opRand(hoek - delta), p2: opRand(hoek + delta), basis: opRand(hoek), zijde: 'ellips', pos: norm, hoek };
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
    const rechts = bx > cx;
    return { p1: { x: bx, y: y - halve }, p2: { x: bx, y: y + halve }, basis: { x: bx, y }, zijde: rechts ? 'rechts' : 'links', pos: rechts ? b + (y - vak.y) : 2 * b + h + (vak.y + h - y) };
  }
  const m = Math.min(r + halve, b / 2);
  const x = klem(bx, vak.x + m, vak.x + b - m);
  const onder = by > cy;
  return { p1: { x: x - halve, y: by }, p2: { x: x + halve, y: by }, basis: { x, y: by }, zijde: onder ? 'onder' : 'boven', pos: onder ? b + h + (vak.x + b - x) : x - vak.x };
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

/**
 * De staarten van een vak: de geldige (punt buiten het vak) in een lijst met
 * hun voet, gesorteerd langs de rand zoals een pad die doorloopt.
 * @param {Array<{tipX:number, tipY:number, endStyle?:string}>} leiders
 */
export function staartLijst(vak, vorm, leiders) {
  const uit = [];
  for (const l of leiders || []) {
    if (l.endStyle !== 'tail') continue;
    const punt = { x: l.tipX, y: l.tipY };
    const voet = staartVoet(vak, vorm, punt);
    if (voet) uit.push({ voet, punt });
  }
  return uit.sort((a, b) => a.voet.pos - b.voet.pos);
}

const K = 0.5522847498;

/**
 * Het pad van vak en staarten als ÉÉN gesloten omtrek, zodat vulling en rand
 * zonder naad door de staart heen lopen (ook bij een doorzichtige vulling).
 * Opdrachten in paginaruimte: ['M', x, y], ['L', x, y], ['C', x1, y1, x2, y2, x, y], ['Z'].
 */
export function vakMetStaartenOpdrachten(vak, vorm, lijst) {
  const b = vak.width || 150;
  const h = vak.height || 50;
  const x0 = vak.x, y0 = vak.y;
  const ops = [];
  if (vorm === 'ellipse') {
    const cx = x0 + b / 2, cy = y0 + h / 2, rx = b / 2, ry = h / 2;
    const op = (a) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    const boog = (van, tot) => {
      const stukken = Math.max(1, Math.ceil(Math.abs(tot - van) / (Math.PI / 2) - 1e-9));
      const stap = (tot - van) / stukken;
      const k = (4 / 3) * Math.tan(stap / 4);
      for (let i = 0; i < stukken; i++) {
        const a0 = van + i * stap, a1 = a0 + stap;
        const [px, py] = op(a0), [qx, qy] = op(a1);
        ops.push(['C', px - k * rx * Math.sin(a0), py + k * ry * Math.cos(a0), qx + k * rx * Math.sin(a1), qy - k * ry * Math.cos(a1), qx, qy]);
      }
    };
    if (lijst.length === 0) {
      const [sx, sy] = op(0);
      ops.push(['M', sx, sy]);
      boog(0, 2 * Math.PI);
      ops.push(['Z']);
      return ops;
    }
    const hoeken = lijst;
    const eerste = hoeken[0];
    const a2 = (t) => Math.atan2((t.voet.p2.y - cy) / ry, (t.voet.p2.x - cx) / rx);
    const a1 = (t) => Math.atan2((t.voet.p1.y - cy) / ry, (t.voet.p1.x - cx) / rx);
    const hoek = (a, referentie) => { let w = a; while (w < referentie) w += 2 * Math.PI; return w; };
    const startHoek = a2(eerste);
    const [bx, by] = op(startHoek);
    ops.push(['M', bx, by]);
    let huidig = startHoek;
    for (let i = 1; i < hoeken.length; i++) {
      const naar = hoek(a1(hoeken[i]), huidig);
      boog(huidig, naar);
      ops.push(['L', hoeken[i].punt.x, hoeken[i].punt.y]);
      const tot = hoek(a2(hoeken[i]), naar);
      const [qx, qy] = op(tot);
      ops.push(['L', qx, qy]);
      huidig = tot;
    }
    const einde = hoek(a1(eerste), huidig);
    boog(huidig, einde);
    ops.push(['L', eerste.punt.x, eerste.punt.y]);
    ops.push(['Z']);
    return ops;
  }
  // Rechthoek (scherp of afgerond): vier randen, kloksgewijs vanaf linksboven.
  const r = vorm === 'rounded' ? hoekStraal(b, h) : 0;
  const k = r * K;
  const van = (zijde) => lijst.filter((t) => t.voet.zijde === zijde);
  const hoek = (cx1, cy1, cx2, cy2, x, y) => (r > 0 ? ops.push(['C', cx1, cy1, cx2, cy2, x, y]) : ops.push(['L', x, y]));
  ops.push(['M', x0 + r, y0]);
  for (const t of van('boven')) ops.push(['L', t.voet.p1.x, t.voet.p1.y], ['L', t.punt.x, t.punt.y], ['L', t.voet.p2.x, t.voet.p2.y]);
  ops.push(['L', x0 + b - r, y0]);
  hoek(x0 + b - r + k, y0, x0 + b, y0 + r - k, x0 + b, y0 + r);
  for (const t of van('rechts')) ops.push(['L', t.voet.p1.x, t.voet.p1.y], ['L', t.punt.x, t.punt.y], ['L', t.voet.p2.x, t.voet.p2.y]);
  ops.push(['L', x0 + b, y0 + h - r]);
  hoek(x0 + b, y0 + h - r + k, x0 + b - r + k, y0 + h, x0 + b - r, y0 + h);
  // Onderrand van rechts naar links: de voetpunten in omgekeerde volgorde.
  for (const t of van('onder')) ops.push(['L', t.voet.p2.x, t.voet.p2.y], ['L', t.punt.x, t.punt.y], ['L', t.voet.p1.x, t.voet.p1.y]);
  ops.push(['L', x0 + r, y0 + h]);
  hoek(x0 + r - k, y0 + h, x0, y0 + h - r + k, x0, y0 + h - r);
  // Linkerrand van onder naar boven.
  for (const t of van('links')) ops.push(['L', t.voet.p2.x, t.voet.p2.y], ['L', t.punt.x, t.punt.y], ['L', t.voet.p1.x, t.voet.p1.y]);
  ops.push(['L', x0, y0 + r]);
  hoek(x0, y0 + r - k, x0 + r - k, y0, x0 + r, y0);
  ops.push(['Z']);
  return ops;
}

/** Zet de opdrachten van vakMetStaartenOpdrachten als pad op een canvas. */
export function bouwVakMetStaartenPad(ctx, vak, vorm, lijst, dx = 0, dy = 0) {
  ctx.beginPath();
  for (const [op, ...p] of vakMetStaartenOpdrachten(vak, vorm, lijst)) {
    if (op === 'M') ctx.moveTo(p[0] + dx, p[1] + dy);
    else if (op === 'L') ctx.lineTo(p[0] + dx, p[1] + dy);
    else if (op === 'C') ctx.bezierCurveTo(p[0] + dx, p[1] + dy, p[2] + dx, p[3] + dy, p[4] + dx, p[5] + dy);
    else ctx.closePath();
  }
}
