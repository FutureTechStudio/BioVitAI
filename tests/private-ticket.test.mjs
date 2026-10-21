import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';
import { createPrivateObjectSecurity } from '../dist/infrastructure/storage/local-private.js';

const input = () => ({
  objectId: randomUUID(),
  profileId: randomUUID(),
  actorId: randomUUID(),
  sessionId: randomUUID(),
  revision: 3,
});
test('private tickets preserve actor/session/profile context and expire in sixty seconds', () => {
  let now = Date.now();
  const signer = createPrivateObjectSecurity(
    randomBytes(32).toString('hex'),
    () => now,
  );
  const value = input(),
    signed = signer.issue(value);
  assert.equal(signed.expiresAt, Math.floor(now / 1000) + 60);
  assert.deepEqual(signer.verify(signed.ticket), {
    ...value,
    version: 1,
    expiresAt: signed.expiresAt,
  });
  now += 61000;
  assert.throws(() => signer.verify(signed.ticket), { code: 'INVALID_TICKET' });
});
test('ticket signatures reject changed payloads, wrong keys and malformed encodings', () => {
  const signer = createPrivateObjectSecurity(randomBytes(32).toString('hex'));
  const { ticket } = signer.issue(input());
  const [payload, signature] = ticket.split('.');
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
  value.profileId = randomUUID();
  assert.throws(
    () =>
      signer.verify(
        `${Buffer.from(JSON.stringify(value)).toString('base64url')}.${signature}`,
      ),
    { code: 'INVALID_TICKET' },
  );
  assert.throws(
    () =>
      createPrivateObjectSecurity(randomBytes(32).toString('hex')).verify(
        ticket,
      ),
    { code: 'INVALID_TICKET' },
  );
  for (const token of ['', ticket + '=', 'x'.repeat(2049), 'a.b'])
    assert.throws(() => signer.verify(token), { code: 'INVALID_TICKET' });
});
test('ticket issuance rejects unknown caller-controlled fields and invalid revisions', () => {
  const signer = createPrivateObjectSecurity(randomBytes(32).toString('hex'));
  assert.throws(() => signer.issue({ ...input(), revision: -1 }));
  assert.throws(() => signer.issue({ ...input(), role: 'owner' }));
});
