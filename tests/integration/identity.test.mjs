import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { postgresFixture, freePort } from '../helpers/postgres.mjs';
import { migrateDatabase } from '../../dist/infrastructure/db/migrations.js';
import { createIdentityAuth } from '../../dist/modules/identity/src/infrastructure/auth.js';
import { createIdentityService } from '../../dist/modules/identity/src/application/current-actor.js';
import { createApiServer } from '../../dist/infrastructure/http/server.js';
import { createStatusService } from '../../dist/apps/api/src/application/status.js';

test(
  'identity HTTP lifecycle against real PostgreSQL',
  { timeout: 120000 },
  async (t) => {
    const fixture = await postgresFixture();
    t.after(() => fixture.close());
    const migrationDirectory = path.resolve('infrastructure/db/migrations');
    await migrateDatabase(fixture.pool, migrationDirectory);
    await migrateDatabase(fixture.pool, migrationDirectory);
    assert.equal(
      (await fixture.pool.query('SELECT count(*) FROM biovitai_migrations'))
        .rows[0].count,
      '11',
    );
    const messages = [];
    const origin = `http://127.0.0.1:${await freePort()}`;
    const authConfig = { origin, secret: randomBytes(32).toString('hex') };
    const identity = createIdentityAuth(fixture.pool, authConfig, {
      deliver: async (message) => {
        messages.push(message);
      },
    });
    const service = createIdentityService(identity.sessions);
    const server = createApiServer(
      createStatusService({ check: identity.ready, close: async () => {} }),
      { origin, handler: identity.handler, currentActor: service.currentActor },
    );
    server.listen(Number(new URL(origin).port), '127.0.0.1');
    await once(server, 'listening');
    t.after(
      () =>
        new Promise((resolve) => {
          server.closeAllConnections();
          server.close(resolve);
        }),
    );
    const password = 'Synthetic account password 826!';
    const alice = 'alice@example.test';
    const bob = 'bob@example.test';
    let cookieA;
    let cookieB;
    let aliceId;
    const call = (route, body, cookie, extra = {}) =>
      fetch(`${origin}${route}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(cookie ? { cookie } : {}),
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'manual',
      });
    const sessionCookie = (response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    const signIn = async (email) => {
      const response = await call('/api/auth/sign-in/email', {
        email,
        password,
      });
      assert.equal(response.status, 200);
      const data = await response.json();
      assert.equal('token' in data, false);
      assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
      assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i);
      return sessionCookie(response);
    };

    await t.test(
      'unverified signup is not a session; verification permits login',
      async () => {
        const signedUp = await call('/api/auth/sign-up/email', {
          name: 'Synthetic Alice',
          email: alice,
          password,
        });
        assert.equal(signedUp.status, 200);
        const duplicate = await call('/api/auth/sign-up/email', {
          name: 'Duplicate synthetic account',
          email: alice,
          password,
        });
        assert.equal(duplicate.status, 200);
        assert.equal(
          (
            await fixture.pool.query(
              'SELECT count(*) FROM identity_user WHERE email = $1',
              [alice],
            )
          ).rows[0].count,
          '1',
        );
        assert.equal((await call('/v1/me')).status, 401);
        assert.equal(
          (await call('/api/auth/sign-in/email', { email: alice, password }))
            .status,
          403,
        );
        const message = messages.find(
          (message) =>
            message.recipient === alice && message.kind === 'verification',
        );
        assert.ok(message);
        const verified = await fetch(message.url, { redirect: 'manual' });
        assert.ok(
          [200, 302].includes(verified.status),
          `verification response status ${verified.status}`,
        );
        cookieA = await signIn(alice);
        const me = await call(
          '/v1/me?actorId=forged-actor',
          undefined,
          cookieA,
        );
        assert.equal(me.status, 200);
        const current = await me.json();
        aliceId = current.actor.id;
        assert.equal(current.actor.email, alice);
        assert.equal(current.actor.emailVerified, true);
        const recreated = createIdentityAuth(fixture.pool, authConfig, {
          deliver: async () => {},
        });
        assert.equal(
          (await recreated.sessions.currentActor({ cookie: cookieA })).id,
          aliceId,
        );
        const stored = await fixture.pool.query(
          'SELECT password FROM identity_account WHERE "userId" = $1',
          [aliceId],
        );
        assert.notEqual(stored.rows[0].password, password);
        const session = await call('/api/auth/get-session', undefined, cookieA);
        assert.equal('token' in (await session.json()).session, false);
      },
    );

    await t.test(
      'invalid cookies, cross-account revocation and session logout fail closed',
      async () => {
        assert.equal(
          (await call('/v1/me', undefined, cookieA.replace('=', '=tampered')))
            .status,
          401,
        );
        assert.equal(
          (
            await call('/api/auth/sign-up/email', {
              name: 'Synthetic Bob',
              email: bob,
              password,
            })
          ).status,
          200,
        );
        const message = messages.find(
          (message) =>
            message.recipient === bob && message.kind === 'verification',
        );
        await fetch(message.url, { redirect: 'manual' });
        cookieB = await signIn(bob);
        const bobActor = (
          await (await call('/v1/me', undefined, cookieB)).json()
        ).actor;
        const target = await fixture.pool.query(
          'SELECT token FROM identity_session WHERE "userId" = $1',
          [bobActor.id],
        );
        const attack = await call(
          '/api/auth/revoke-session',
          { token: target.rows[0].token },
          cookieA,
        );
        assert.ok([200, 400, 403, 404].includes(attack.status));
        assert.equal((await call('/v1/me', undefined, cookieB)).status, 200);
        assert.equal(
          (await call('/api/auth/sign-out', {}, cookieB)).status,
          200,
        );
        assert.equal((await call('/v1/me', undefined, cookieB)).status, 401);
      },
    );

    await t.test(
      'logout-all immediately invalidates both database sessions',
      async () => {
        const secondCookie = await signIn(alice);
        assert.ok(secondCookie !== cookieA);
        assert.equal(
          (await call('/api/auth/revoke-sessions', {}, cookieA)).status,
          200,
        );
        assert.equal((await call('/v1/me', undefined, cookieA)).status, 401);
        assert.equal(
          (await call('/v1/me', undefined, secondCookie)).status,
          401,
        );
        cookieA = await signIn(alice);
        await fixture.pool.query(
          'UPDATE identity_session SET "expiresAt" = now() - interval \'1 minute\' WHERE "userId" = $1',
          [aliceId],
        );
        assert.equal((await call('/v1/me', undefined, cookieA)).status, 401);
      },
    );

    await t.test(
      'origin checks, payload limits and invalid verification cannot bypass authentication',
      async () => {
        assert.equal(
          (
            await call(
              '/api/auth/sign-in/email',
              { email: alice, password },
              undefined,
              { origin: 'https://evil.invalid' },
            )
          ).status,
          403,
        );
        const redirected = await call('/api/auth/sign-up/email', {
          name: 'Bad redirect',
          email: 'redirect@example.test',
          password,
          callbackURL: 'https://evil.invalid/steal',
        });
        assert.ok([400, 403].includes(redirected.status));
        assert.equal(
          (
            await call('/api/auth/sign-up/email', {
              name: 'X'.repeat(20000),
              email: 'large@example.test',
              password,
            })
          ).status,
          413,
        );
        const badVerification = await call(
          '/api/auth/verify-email?token=tampered',
        );
        assert.ok([400, 401, 403, 302].includes(badVerification.status));
        assert.equal(
          (
            await call('/api/auth/sign-in/email', {
              email: alice,
              password: 'wrong-password-here',
            })
          ).status,
          401,
        );
      },
    );

    await t.test(
      'password reset is single use and revokes prior sessions',
      async () => {
        const beforeReset = await signIn(alice);
        assert.equal(
          (
            await call('/api/auth/request-password-reset', {
              email: alice,
              redirectTo: `${origin}/reset`,
            })
          ).status,
          200,
        );
        const message = messages.findLast(
          (message) =>
            message.recipient === alice && message.kind === 'password-reset',
        );
        assert.ok(message);
        const redirect = await fetch(message.url, { redirect: 'manual' });
        assert.equal(redirect.status, 302);
        const resetURL = new URL(redirect.headers.get('location'), origin);
        const token = resetURL.searchParams.get('token');
        assert.ok(token);
        const newPassword = 'New synthetic password 981!';
        assert.equal(
          (await call('/api/auth/reset-password', { token, newPassword }))
            .status,
          200,
        );
        assert.equal(
          (await call('/v1/me', undefined, beforeReset)).status,
          401,
        );
        assert.notEqual(
          (await call('/api/auth/reset-password', { token, newPassword }))
            .status,
          200,
        );
        const login = await call('/api/auth/sign-in/email', {
          email: alice,
          password: newPassword,
        });
        assert.equal(login.status, 200);
      },
    );

    await t.test('rate limit resists spoofed forwarding headers', async () => {
      await fixture.pool.query('DELETE FROM identity_rate_limit');
      let response;
      for (let i = 0; i < 11; i++) {
        response = await call(
          '/api/auth/sign-in/email',
          { email: 'missing@example.test', password },
          undefined,
          {
            'x-forwarded-for': `10.0.0.${i}`,
            'x-biovitai-remote-address': `10.1.0.${i}`,
          },
        );
      }
      assert.equal(response.status, 429);
    });

    await t.test(
      'migration checksums detect tampering and DDL failures roll back',
      async () => {
        const temporary = path.join(fixture.directory, 'migration-fixtures');
        await fs.mkdir(temporary);
        await fs.writeFile(
          path.join(temporary, '0001_identity.sql'),
          '-- altered migration',
        );
        await assert.rejects(
          migrateDatabase(fixture.pool, temporary),
          /checksum mismatch/,
        );
        await fs.rm(path.join(temporary, '0001_identity.sql'));
        await fs.writeFile(
          path.join(temporary, '0002_failure.sql'),
          'CREATE TABLE identity_rollback_test(id integer); SELECT missing_function_for_test();',
        );
        await assert.rejects(migrateDatabase(fixture.pool, temporary));
        assert.equal(
          (
            await fixture.pool.query(
              "SELECT to_regclass('identity_rollback_test') AS table_name",
            )
          ).rows[0].table_name,
          null,
        );
      },
    );
  },
);
