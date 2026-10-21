import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  DecimalSchema,
  EvidenceTimeSchema,
  EvidenceValueSchema,
  RawFieldSchema,
  SourceObservationSchema,
} from '../dist/modules/health/src/contracts/evidence.js';

function observation() {
  return {
    schemaVersion: '1.0.0',
    id: randomUUID(),
    profileId: randomUUID(),
    reportId: randomUUID(),
    candidateId: null,
    concept: null,
    original: {
      name: 'Synthetic marker',
      value: '<5',
      unit: 'mg/L',
      referenceText: null,
    },
    value: { kind: 'quantity', amount: '5', comparator: '<' },
    sourceFields: {
      name: randomUUID(),
      value: randomUUID(),
      unit: randomUUID(),
      reference: null,
      method: null,
      observedTime: null,
      resultTime: null,
    },
    reference: { low: null, high: null, context: {} },
    specimenId: null,
    method: null,
    observedTime: { precision: 'unknown' },
    resultTime: { precision: 'unknown' },
    normalized: null,
    revision: 1,
    previousObservationId: null,
    correctionReason: null,
    recordedBy: randomUUID(),
  };
}
test('health quantities preserve comparator and arbitrary decimal precision without number coercion', () => {
  const input = observation();
  assert.equal(SourceObservationSchema.parse(input).value.comparator, '<');
  const exact = '12345678901234567890.12345678901234567890';
  assert.equal(DecimalSchema.parse(exact), exact);
  for (const value of [5, 'NaN', 'Infinity', '1e3', ''])
    assert.equal(DecimalSchema.safeParse(value).success, false);
});
test('unknown and date-only evidence never invent an instant; invalid dates and local timestamps fail', () => {
  assert.deepEqual(EvidenceTimeSchema.parse({ precision: 'unknown' }), {
    precision: 'unknown',
  });
  assert.deepEqual(
    EvidenceTimeSchema.parse({ precision: 'date', date: '2026-10-19' }),
    { precision: 'date', date: '2026-10-19' },
  );
  for (const value of [
    { precision: 'date', date: '2026-02-30' },
    { precision: 'unknown', at: '2026-10-19T00:00:00Z' },
    { precision: 'instant', at: '2026-10-19T12:00:00', timezone: null },
  ])
    assert.equal(EvidenceTimeSchema.safeParse(value).success, false);
});
test('qualitative and missing results stay distinct from numeric zero', () => {
  assert.equal(
    EvidenceValueSchema.parse({ kind: 'qualitative', text: 'Negative' }).text,
    'Negative',
  );
  assert.equal(
    EvidenceValueSchema.parse({ kind: 'missing', reason: 'Not performed' })
      .kind,
    'missing',
  );
  assert.equal(
    EvidenceValueSchema.safeParse({
      kind: 'missing',
      reason: 'Unknown',
      amount: '0',
    }).success,
    false,
  );
  assert.equal(
    EvidenceValueSchema.safeParse({ kind: 'quantity', amount: '0' }).success,
    false,
  );
});
test('raw evidence requires a valid source rectangle and extraction version', () => {
  const value = {
    schemaVersion: '1.0.0',
    id: randomUUID(),
    profileId: randomUUID(),
    documentId: randomUUID(),
    reportId: randomUUID(),
    pageId: randomUUID(),
    rawText: '<5 mg/L',
    box: { x0: 0.1, y0: 0.2, x1: 0.4, y1: 0.3 },
    extractor: { name: 'synthetic fixture', version: '1', confidence: 0.9 },
  };
  assert.ok(RawFieldSchema.safeParse(value).success);
  value.box.x1 = 0.05;
  assert.equal(RawFieldSchema.safeParse(value).success, false);
});
test('source DTOs reject implicit verification, missing field provenance and unjustified revisions', () => {
  assert.equal(
    SourceObservationSchema.safeParse({
      ...observation(),
      verificationState: 'verified',
    }).success,
    false,
  );
  const value = observation();
  value.sourceFields.unit = null;
  assert.equal(SourceObservationSchema.safeParse(value).success, false);
  assert.equal(
    SourceObservationSchema.safeParse({ ...observation(), revision: 2 })
      .success,
    false,
  );
  assert.ok(
    SourceObservationSchema.safeParse({
      ...observation(),
      revision: 2,
      previousObservationId: randomUUID(),
      correctionReason: 'Synthetic correction',
    }).success,
  );
});
test('range validation compares decimal strings exactly', () => {
  const value = observation();
  value.sourceFields.reference = randomUUID();
  value.reference.low = '1.0000000000000000000002';
  value.reference.high = '1.0000000000000000000001';
  assert.equal(SourceObservationSchema.safeParse(value).success, false);
  value.reference.low = '-10.5';
  value.reference.high = '-2';
  assert.ok(SourceObservationSchema.safeParse(value).success);
  value.reference.low = 'NaN';
  assert.equal(SourceObservationSchema.safeParse(value).success, false);
});
