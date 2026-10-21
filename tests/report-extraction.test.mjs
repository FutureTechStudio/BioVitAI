import assert from 'node:assert/strict';
import test from 'node:test';
import { TextEncoder } from 'node:util';
import { parseReportLine } from '../dist/modules/health/src/domain/extraction.js';
import { detectReportMedia } from '../dist/modules/health/src/application/reports.js';

const cases = [];
for (const comparator of ['=', '<', '<=', '>', '>='])
  for (const amount of [
    '0',
    '5',
    '5.90',
    '12345678901234567890.1234',
    '-1.25',
    '0.001',
    '99.999',
    '7.0',
    '100',
    '1.0001',
  ])
    cases.push({
      raw: `Synthetic Marker ${comparator}${amount} mg/L 0 - 10`,
      comparator,
      amount,
    });
test('50 exact numeric extraction goldens preserve comparators and decimal strings without calculation', () => {
  assert.equal(cases.length, 50);
  for (const example of cases) {
    const row = parseReportLine({ text: example.raw });
    assert.deepEqual(row, {
      originalName: 'Synthetic Marker',
      value: {
        kind: 'quantity',
        comparator: example.comparator,
        amount: example.amount,
      },
      unit: 'mg/L',
      referenceText: '0 - 10',
    });
  }
});
test('qualitative, missing and unsupported rows never turn into numerical zero', () => {
  assert.deepEqual(
    parseReportLine({ text: 'Synthetic Assay Not detected' })?.value,
    { kind: 'qualitative', text: 'Not detected' },
  );
  assert.deepEqual(
    parseReportLine({ text: 'Synthetic Assay Insufficient sample' })?.value,
    { kind: 'missing', reason: 'Insufficient sample' },
  );
  for (const text of [
    'Patient: Synthetic Person',
    'Date: 2026-01-01',
    'Synthetic Marker 5,90 mg/L',
    'Synthetic Marker NaN mg/L',
    'Clinical note only',
  ])
    assert.equal(parseReportLine({ text }), null);
});
test('media inspection rejects extensions and arbitrary bytes as evidence of format', () => {
  assert.equal(
    detectReportMedia(new TextEncoder().encode('%PDF-1.7\n')),
    'application/pdf',
  );
  assert.equal(
    detectReportMedia(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    'image/png',
  );
  assert.throws(
    () => detectReportMedia(new TextEncoder().encode('file-name.pdf')),
    { code: 'UNSUPPORTED_MEDIA_TYPE' },
  );
});
