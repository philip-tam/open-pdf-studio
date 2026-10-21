import assert from 'node:assert/strict';
import test from 'node:test';
import { builtinStampMaat } from './stamp-defaults.js';

test('builtinStampMaat: een kwart van de paginabreedte, beeldverhouding 16:5', () => {
  assert.deepEqual(builtinStampMaat(595), { width: 149, height: 47 });
});

test('builtinStampMaat: begrensd door de vaste maat en een minimum', () => {
  assert.equal(builtinStampMaat(100000).width, 1600);
  assert.equal(builtinStampMaat(100).width, 100);
});

test('builtinStampMaat: zonder paginamaat de vaste standaardmaat', () => {
  assert.deepEqual(builtinStampMaat(null), { width: 1600, height: 500 });
  assert.deepEqual(builtinStampMaat(undefined), { width: 1600, height: 500 });
});
