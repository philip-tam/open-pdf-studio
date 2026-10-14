import assert from 'node:assert/strict';
import test from 'node:test';
import { pdfBytesHaveEncryption } from './encrypted-pdf.js';

const bytes = (s) => new TextEncoder().encode(s);

test('pdfBytesHaveEncryption: trailer with /Encrypt reference', () => {
  assert.equal(pdfBytesHaveEncryption(bytes('%PDF-1.6\n...\ntrailer\n<< /Size 9 /Root 1 0 R /Encrypt 8 0 R >>\nstartxref\n1\n%%EOF')), true);
});

test('pdfBytesHaveEncryption: plain PDF and empty input', () => {
  assert.equal(pdfBytesHaveEncryption(bytes('%PDF-1.4\ntrailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n1\n%%EOF')), false);
  assert.equal(pdfBytesHaveEncryption(new Uint8Array()), false);
});

test('pdfBytesHaveEncryption: finds /Encrypt at the start of a long file', () => {
  const lang = '%PDF-1.5\n<< /Linearized 1 /Encrypt 5 0 R >>\n' + 'x'.repeat(40000);
  assert.equal(pdfBytesHaveEncryption(bytes(lang)), true);
});
