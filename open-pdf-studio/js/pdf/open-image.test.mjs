import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { isAfbeeldingPad, afbeeldingNaarPdf } from './open-image-pdf.js';

// Een PNG van 2 x 1 pixel.
const PNG_2X1 = Uint8Array.from(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEElEQVR4nGP4z8Dwn4EBDAAZ/wL+QDEPzAAAAABJRU5ErkJggg==', 'base64'));

test('isAfbeeldingPad: afbeeldingen ja, pdf en niets nee', () => {
  assert.equal(isAfbeeldingPad('/a/b/foto.PNG'), true);
  assert.equal(isAfbeeldingPad('C:\\x\\foto.jpeg'), true);
  assert.equal(isAfbeeldingPad('plan.pdf'), false);
  assert.equal(isAfbeeldingPad(''), false);
  assert.equal(isAfbeeldingPad(undefined), false);
});

test('afbeeldingNaarPdf: één pagina op de maat van de afbeelding', async () => {
  const bytes = await afbeeldingNaarPdf(PNG_2X1, 'png');
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width - 1.5) < 1e-6 && Math.abs(height - 0.75) < 1e-6);
});
