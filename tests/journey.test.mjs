import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  storyDate,
  StoryContentSchema,
  SaveStorySchema,
} from '../dist/shared/contracts/src/journey.js';
import {
  changedStory,
  dateOverlaps,
  orderJourney,
} from '../dist/modules/health/src/domain/journey.js';
import { createEncryptedJson } from '../dist/infrastructure/storage/encrypted-json.js';

test('story dates preserve unknown/approximate precision and reject impossible dates', () => {
  assert.deepEqual(storyDate(''), { precision: 'unknown', value: null });
  assert.equal(storyDate('2025').precision, 'year');
  assert.equal(storyDate('2025-02').precision, 'month');
  assert.equal(storyDate('2024-02-29').precision, 'day');
  for (const v of ['2025-02-29', '2025-13', '2025-00-01', 'tomorrow', '0000'])
    assert.throws(() => storyDate(v));
  assert.equal(dateOverlaps('2025', '2025-03-01', '2025-04-01'), true);
  assert.equal(dateOverlaps('2025-02', '2025-02-20', '2025-02-28'), true);
  assert.equal(dateOverlaps('2025-02', '2025-03-01', null), false);
  assert.equal(
    dateOverlaps('2020-01-01', '2024-03-01', '2024-04-01', '2025-01-01'),
    true,
  );
  assert.equal(dateOverlaps(null, '2025-01-01', null), false);
});
test('timeline orders effective and recorded dates separately, with an unknown lane', () => {
  const events = [
    { id: 'old', date: storyDate('2020'), recordedAt: '2026-10-22' },
    { id: 'unknown', date: storyDate(''), recordedAt: '2026-10-23' },
    { id: 'recent', date: storyDate('2026-01-01'), recordedAt: '2026-10-21' },
  ];
  assert.deepEqual(
    orderJourney(events, 'effective').map((x) => x.id),
    ['recent', 'old', 'unknown'],
  );
  assert.deepEqual(
    orderJourney(events, 'recorded').map((x) => x.id),
    ['unknown', 'old', 'recent'],
  );
  assert.equal(changedStory({ a: '1' }, null).length, 0);
  assert.deepEqual(changedStory({ a: '2', b: '1' }, { a: '1', c: '1' }), [
    { id: 'a', kind: 'updated' },
    { id: 'b', kind: 'added' },
    { id: 'c', kind: 'removed' },
  ]);
});
test('context contracts require attribution, explicit confirmation and valid intervals', () => {
  const content = {
    information: {
      kind: 'condition',
      label: 'A concern',
      details: 'Reported concern only',
      assertion: 'concern',
    },
    start: storyDate('2025'),
    end: storyDate('2025-01'),
    state: 'uncertain',
    source: { kind: 'reported' },
    conflictsWith: [],
  };
  assert.equal(StoryContentSchema.safeParse(content).success, true);
  assert.equal(
    StoryContentSchema.safeParse({
      ...content,
      start: storyDate('2026'),
      end: storyDate('2025'),
    }).success,
    false,
  );
  assert.equal(
    StoryContentSchema.safeParse({
      ...content,
      source: { kind: 'clinician_confirmed' },
    }).success,
    false,
  );
  const input = {
    context: { profileId: randomUUID(), revision: 1 },
    requestKey: randomUUID(),
    recordId: randomUUID(),
    expectedRevision: 0,
    reason: 'Initial reported concern',
    content,
  };
  assert.equal(SaveStorySchema.safeParse(input).success, false);
  assert.equal(
    SaveStorySchema.safeParse({ ...input, confirmed: true }).success,
    true,
  );
  assert.equal(
    SaveStorySchema.safeParse({
      ...input,
      confirmed: true,
      diagnosisApproved: true,
    }).success,
    false,
  );
});
test('encrypted context and checkpoints bind purpose, subject and immutable version', () => {
  const secret = randomBytes(48).toString('hex'),
    crypto = createEncryptedJson(secret, 'health-story.v1'),
    profile = randomUUID(),
    id = randomUUID();
  const value = { details: 'SYNTHETIC private reported medicine' },
    cipher = crypto.encrypt(profile, id, value);
  assert.equal(cipher.includes(Buffer.from(value.details)), false);
  assert.deepEqual(crypto.decrypt(profile, id, cipher), value);
  assert.throws(() => crypto.decrypt(randomUUID(), id, cipher));
  assert.throws(() => crypto.decrypt(profile, randomUUID(), cipher));
  assert.throws(() =>
    createEncryptedJson(secret, 'different-purpose').decrypt(
      profile,
      id,
      cipher,
    ),
  );
  const altered = Buffer.from(cipher);
  altered[16] ^= 1;
  assert.throws(() => crypto.decrypt(profile, id, altered));
});
