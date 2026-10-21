import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  PublicProfileSchema,
  ProfileContextSchema,
  ProfileListSchema,
  CurrentAccountSchema,
} from '../dist/shared/contracts/src/web.js';

const profile = {
  id: randomUUID(),
  ownerId: randomUUID(),
  displayName: 'Synthetic member',
  kind: 'family',
};
test('public profile responses reject private fields instead of silently stripping leaks', () => {
  assert.deepEqual(PublicProfileSchema.parse(profile), profile);
  for (const field of [
    'contactEmail',
    'contact_email',
    'consents',
    'token',
    'sessionId',
    'health',
  ]) {
    const leaked = { ...profile, [field]: 'private' };
    assert.equal(PublicProfileSchema.safeParse(leaked).success, false);
    assert.equal(
      ProfileListSchema.safeParse({ profiles: [leaked] }).success,
      false,
    );
    assert.equal(
      ProfileContextSchema.safeParse({ profile: leaked, revision: 1 }).success,
      false,
    );
  }
});
test('public account and context responses validate identity, revision and exact envelopes', () => {
  const actor = {
    id: randomUUID(),
    email: 'synthetic@example.test',
    emailVerified: true,
  };
  assert.equal(CurrentAccountSchema.safeParse({ actor }).success, true);
  for (const input of [
    { actor: { ...actor, token: 'private' } },
    { actor: { ...actor, sessionId: 'private' } },
    { actor: { ...actor, emailVerified: false } },
    { actor, token: 'private' },
  ])
    assert.equal(CurrentAccountSchema.safeParse(input).success, false);
  for (const input of [
    { profile, revision: -1 },
    { profile, revision: 1.5 },
    { profile, revision: 1, token: 'private' },
    { profile: { ...profile, id: 'bad' }, revision: 1 },
  ])
    assert.equal(ProfileContextSchema.safeParse(input).success, false);
  assert.deepEqual(ProfileContextSchema.parse({ profile: null, revision: 0 }), {
    profile: null,
    revision: 0,
  });
});

test('web upstream configuration accepts only a loopback port and never an arbitrary host', async () => {
  const previous = process.env.BIOVITAI_TEST_API_PORT;
  let iteration = 0;
  try {
    for (const value of [
      '0',
      '65536',
      '3001/evil',
      'https://evil.invalid',
      '3001?host=evil',
      '03001',
    ]) {
      process.env.BIOVITAI_TEST_API_PORT = value;
      await assert.rejects(
        import(`../apps/web/next.config.mjs?invalid=${iteration++}`),
        /Invalid loopback API port/,
      );
    }
    process.env.BIOVITAI_TEST_API_PORT = '43210';
    const { default: config } =
      await import('../apps/web/next.config.mjs?valid=port');
    const rewrites = await config.rewrites();
    assert.equal(rewrites.length, 2);
    for (const rewrite of rewrites)
      assert.ok(rewrite.destination.startsWith('http://127.0.0.1:43210/'));
  } finally {
    if (previous === undefined) delete process.env.BIOVITAI_TEST_API_PORT;
    else process.env.BIOVITAI_TEST_API_PORT = previous;
  }
});
