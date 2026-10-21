// Pure rules of "Protect with password" (see protect-pdf.js): no state, no DOM.

/** The rights a recipient has; all on = unrestricted. */
export const STANDAARD_RECHTEN = Object.freeze({
  print: true,
  printHogeKwaliteit: true,
  wijzigen: true,
  kopieren: true,
  annoteren: true,
  formulieren: true,
  samenstellen: true,
  toegankelijkheid: true,
});

/**
 * Checks the dialog input. Returns an i18n key (dialogs namespace) for the
 * first problem, or null when the input can be used.
 * @param {{ gebruiker: string, gebruikerHerhaald: string, eigenaar: string, eigenaarHerhaald: string }} v
 */
export function controleerWachtwoorden({ gebruiker, gebruikerHerhaald, eigenaar, eigenaarHerhaald }) {
  if (!gebruiker && !eigenaar) return 'protectPdf.needPassword';
  if (gebruiker !== gebruikerHerhaald) return 'protectPdf.userMismatch';
  if (eigenaar !== eigenaarHerhaald) return 'protectPdf.ownerMismatch';
  if (gebruiker && eigenaar && gebruiker === eigenaar) return 'protectPdf.samePassword';
  return null;
}

