// De standaard weergavemodus van een nieuw document: één pagina of doorlopend.
//
// Eerder was doorlopend de standaard en dwong het laden van de voorkeuren elke
// opgeslagen waarde terug naar doorlopend. Nu is één pagina de standaard. Een
// bewaarde voorkeur van vóór deze wijziging (altijd 'continuous', want de
// vorige regel schreef die zelf) telt niet als bewuste keuze en gaat één keer
// naar 'single'; daarna blijft wat de gebruiker in de voorkeuren kiest staan.

export const WEERGAVEMODI = ['single', 'continuous'];

/** Het opgeslagen voorkeurenobject, in zijn plaats aangepast. Geeft hetzelfde object terug. */
export function migreerStandaardWeergave(loaded) {
  if (!loaded || typeof loaded !== 'object') return loaded;
  if (!loaded.defaultViewModeV2) {
    loaded.defaultViewMode = 'single';
    loaded.defaultViewModeV2 = true;
  } else if (!WEERGAVEMODI.includes(loaded.defaultViewMode)) {
    loaded.defaultViewMode = 'single';
  }
  return loaded;
}

/** De weergavemodus die een nieuw document krijgt. */
export function standaardWeergave(voorkeuren) {
  return voorkeuren?.defaultViewMode === 'continuous' ? 'continuous' : 'single';
}
