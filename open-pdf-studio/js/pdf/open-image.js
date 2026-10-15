// Een afbeelding (png, jpg, ...) openen als PDF-document: "Openen met" in de
// verkenner of Finder. De afbeelding wordt één pagina in een tijdelijk,
// naamloos document, zodat het origineel nooit wordt overschreven; opslaan
// vraagt om een bestandsnaam.

import { AFBEELDING_EXTENSIES, isAfbeeldingPad, afbeeldingNaarPdf } from './open-image-pdf.js';
import { isTauri, readBinaryFile, invoke } from '../core/platform.js';
import { state, getNextUntitledName } from '../core/state.js';
import { createTab, updateWindowTitle, markDocumentModified } from '../ui/chrome/tabs.js';

export { AFBEELDING_EXTENSIES, isAfbeeldingPad, afbeeldingNaarPdf };

// pdf-lib kan alleen png en jpeg insluiten; de rest gaat via een canvas.
async function leesAfbeelding(pad) {
  const bytes = new Uint8Array(await readBinaryFile(pad));
  const ext = String(pad).split('.').pop().toLowerCase();
  if (ext === 'png') return { bytes, soort: 'png' };
  if (ext === 'jpg' || ext === 'jpeg') return { bytes, soort: 'jpeg' };
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('image conversion failed');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), soort: 'png' };
}

/**
 * Opent het bestand als naamloos PDF-document.
 * @returns {Promise<boolean>} true als het een afbeelding was en geopend is
 */
export async function openAlsAfbeelding(pad) {
  if (!isAfbeeldingPad(pad) || !isTauri() || !window.__TAURI__?.path || !window.__TAURI__?.fs) return false;
  const { loadPDF } = await import('./loader.js');
  const { fitPage } = await import('./renderer.js');
  const { bytes, soort } = await leesAfbeelding(pad);
  const pdfBytes = await afbeeldingNaarPdf(bytes, soort);
  const naam = String(pad).split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || getNextUntitledName();

  const tempDir = await window.__TAURI__.path.tempDir();
  const sep = (tempDir.endsWith('/') || tempDir.endsWith('\\')) ? '' : '/';
  const tempPath = `${tempDir}${sep}opds-untitled-${Date.now()}.pdf`;
  try { await invoke('allow_fs_scope', { path: tempPath }); } catch { /* best effort */ }
  await window.__TAURI__.fs.writeFile(tempPath, pdfBytes);

  const { index } = createTab(tempPath);
  const doc = state.documents[index];
  if (doc) doc.isUntitled = true;
  await loadPDF(tempPath, index, pdfBytes);
  if (doc) doc.fileName = `${naam}.pdf`;
  markDocumentModified();
  try { await fitPage(); } catch (e) { console.warn('[open-image] fitPage failed:', e); }
  updateWindowTitle();
  return true;
}
