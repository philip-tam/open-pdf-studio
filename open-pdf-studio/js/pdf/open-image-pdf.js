// Pure delen van het openen van een afbeelding als PDF (zie open-image.js).

import { PDFDocument } from 'pdf-lib';

export const AFBEELDING_EXTENSIES = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp'];

const PT_PER_PX = 0.75; // 96 pixels per inch

export function isAfbeeldingPad(pad) {
  const ext = String(pad || '').split('.').pop().toLowerCase();
  return AFBEELDING_EXTENSIES.includes(ext);
}

/** De bytes van een PDF met de afbeelding als enige pagina, op zijn eigen maat. */
export async function afbeeldingNaarPdf(bytes, soort) {
  const pdf = await PDFDocument.create();
  const plaatje = soort === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const breedte = plaatje.width * PT_PER_PX;
  const hoogte = plaatje.height * PT_PER_PX;
  const pagina = pdf.addPage([breedte, hoogte]);
  pagina.drawImage(plaatje, { x: 0, y: 0, width: breedte, height: hoogte });
  return new Uint8Array(await pdf.save());
}

