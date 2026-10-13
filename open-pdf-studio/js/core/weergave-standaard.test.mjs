import assert from 'node:assert/strict';
import test from 'node:test';
import { migreerStandaardWeergave, standaardWeergave } from './weergave-standaard.js';

test('een oude voorkeur (altijd continuous) gaat één keer naar single', () => {
  const v = migreerStandaardWeergave({ defaultViewMode: 'continuous' });
  assert.equal(v.defaultViewMode, 'single');
  assert.equal(v.defaultViewModeV2, true);
});

test('zonder opgeslagen waarde wordt het single', () => {
  assert.equal(migreerStandaardWeergave({}).defaultViewMode, 'single');
});

test('na de migratie blijft een bewuste keuze voor doorlopend staan', () => {
  const v = migreerStandaardWeergave({ defaultViewMode: 'continuous', defaultViewModeV2: true });
  assert.equal(v.defaultViewMode, 'continuous');
  const w = migreerStandaardWeergave({ defaultViewMode: 'single', defaultViewModeV2: true });
  assert.equal(w.defaultViewMode, 'single');
});

test('een onbekende waarde valt terug op single', () => {
  assert.equal(migreerStandaardWeergave({ defaultViewMode: 'raar', defaultViewModeV2: true }).defaultViewMode, 'single');
});

test('onbruikbare invoer blijft ongewijzigd', () => {
  assert.equal(migreerStandaardWeergave(null), null);
  assert.equal(migreerStandaardWeergave(undefined), undefined);
});

test('standaardWeergave: alleen een uitdrukkelijk continuous geeft doorlopend', () => {
  assert.equal(standaardWeergave({ defaultViewMode: 'continuous' }), 'continuous');
  assert.equal(standaardWeergave({ defaultViewMode: 'single' }), 'single');
  assert.equal(standaardWeergave({}), 'single');
  assert.equal(standaardWeergave(undefined), 'single');
});
