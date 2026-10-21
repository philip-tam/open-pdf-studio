import assert from 'node:assert/strict';
import test from 'node:test';
import { controleerWachtwoorden } from './protect-pdf-regels.js';

const leeg = { gebruiker: '', gebruikerHerhaald: '', eigenaar: '', eigenaarHerhaald: '' };

test('controleerWachtwoorden: minstens één wachtwoord', () => {
  assert.equal(controleerWachtwoorden(leeg), 'protectPdf.needPassword');
});

test('controleerWachtwoorden: een open-wachtwoord alleen is genoeg', () => {
  assert.equal(controleerWachtwoorden({ ...leeg, gebruiker: 'abc', gebruikerHerhaald: 'abc' }), null);
});

test('controleerWachtwoorden: een rechten-wachtwoord alleen is genoeg', () => {
  assert.equal(controleerWachtwoorden({ ...leeg, eigenaar: 'abc', eigenaarHerhaald: 'abc' }), null);
});

test('controleerWachtwoorden: herhaling moet kloppen', () => {
  assert.equal(controleerWachtwoorden({ ...leeg, gebruiker: 'abc', gebruikerHerhaald: 'abd' }), 'protectPdf.userMismatch');
  assert.equal(controleerWachtwoorden({ ...leeg, eigenaar: 'abc', eigenaarHerhaald: '' }), 'protectPdf.ownerMismatch');
});

test('controleerWachtwoorden: twee gelijke wachtwoorden zijn niet toegestaan', () => {
  assert.equal(
    controleerWachtwoorden({ gebruiker: 'abc', gebruikerHerhaald: 'abc', eigenaar: 'abc', eigenaarHerhaald: 'abc' }),
    'protectPdf.samePassword');
});
