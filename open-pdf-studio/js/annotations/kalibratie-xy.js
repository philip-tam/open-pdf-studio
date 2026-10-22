// De stappen van "Kalibreren per as" buiten de muis om: de maat vragen, vragen
// of de andere as ook moet, en de schaal toepassen (kalibratie-xy-tool).

import { openDialog } from '../solid/stores/dialogStore.js';
import { showConfirm } from '../ui/chrome/confirm-dialog.js';
import { showMessage } from '../solid/stores/dialogStore.js';
import i18next from '../i18n/config.js';
import { schaalUitAssen, isAnisotroop } from './schaal-xy.js';
import { recalculateAllMeasurements, saveDocumentScale, formatMeasurement } from './measurement.js';
import { recordMeasureScale, beginUndoTransaction, endUndoTransaction } from '../core/undo-manager.js';

const t = (sleutel, opties) => i18next.t(`dialogs:calibrateXy.${sleutel}`, opties);

/**
 * Vraagt de echte maat van een getraceerde lijn.
 * @returns {Promise<{waarde:number, eenheid:string}|null>} null als de gebruiker annuleert
 */
export function vraagAsMaat(as, punten) {
  return new Promise((resolve) => {
    openDialog('calibrate-xy', { as, punten, resolve });
  });
}

/** Vraagt of ook de andere as gekalibreerd moet worden. */
export function vraagOokAndereAs(gedaan, andere) {
  return showConfirm({
    title: t('title'),
    message: t('askOther', {
      done: t(gedaan === 'x' ? 'axisX' : 'axisY'),
      other: t(andere === 'x' ? 'axisX' : 'axisY'),
    }),
  });
}

/**
 * Zet de documentschaal uit de gemeten assen, herberekent alle metingen en
 * meldt het resultaat. Eén ongedaan-maken-stap.
 */
export async function pasKalibratieToe(doc, gemeten) {
  if (!doc) return false;
  const nieuw = schaalUitAssen(gemeten);
  if (!nieuw) {
    showMessage(t('failed'));
    return false;
  }
  const oud = doc.measureScale == null ? doc.measureScale : JSON.parse(JSON.stringify(doc.measureScale));
  beginUndoTransaction();
  doc.measureScale = nieuw;
  saveDocumentScale(doc);
  recalculateAllMeasurements();
  recordMeasureScale(oud, nieuw);
  endUndoTransaction();
  const maat = (ppu) => formatMeasurement({ value: 100 / ppu, unit: nieuw.unit });
  showMessage(isAnisotroop(nieuw)
    ? t('doneBoth', { x: maat(nieuw.pixelsPerUnit), y: maat(nieuw.pixelsPerUnitY) })
    : t('doneOne', { x: maat(nieuw.pixelsPerUnit) }));
  return true;
}
