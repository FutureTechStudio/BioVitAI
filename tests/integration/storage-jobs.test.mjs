import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { postgresFixture, freePort } from '../helpers/postgres.mjs';
import { migrateDatabase } from '../../dist/infrastructure/db/migrations.js';
import { createIdentityAuth } from '../../dist/modules/identity/src/infrastructure/auth.js';
import {
  createProfileStore,
  invitationTokens,
} from '../../dist/modules/identity/src/infrastructure/profiles.js';
import { createProfileService } from '../../dist/modules/identity/src/application/profiles.js';
import {
  createLocalPrivateFiles,
  createPrivateObjectSecurity,
  MAX_PRIVATE_BYTES,
} from '../../dist/infrastructure/storage/local-private.js';
import { createPrivateObjectMetadata } from '../../dist/infrastructure/storage/postgres.js';
import {
  createDurableJobs,
  createVerifiedAccounts,
} from '../../dist/infrastructure/jobs/postgres.js';
import { createPrivateObjects } from '../../dist/modules/health/src/application/private-objects.js';
import { PrivateObjectError } from '../../dist/modules/health/src/contracts/private-objects.js';
import { createPrivateObjectWorker } from '../../dist/apps/worker/src/application/private-object-job.js';
import { createPrivateObjectController } from '../../dist/apps/api/src/controllers/private-objects.js';
import { createProfileController } from '../../dist/apps/api/src/controllers/profiles.js';
import { createStatusService } from '../../dist/apps/api/src/application/status.js';
import { createApiServer } from '../../dist/infrastructure/http/server.js';

test(
  'private storage, signed HTTP access and durable jobs on PostgreSQL',
  { timeout: 120000 },
  async (t) => {
    const fixture = await postgresFixture();
    t.after(() => fixture.close());
    const pool = fixture.pool;
    await migrateDatabase(pool, path.resolve('infrastructure/db/migrations'));
    await migrateDatabase(pool, path.resolve('infrastructure/db/migrations'));
    const origin = `http://127.0.0.1:${await freePort()}`,
      secret = randomBytes(32).toString('hex');
    const messages = [],
      invitations = [];
    const auth = createIdentityAuth(
      pool,
      { origin, secret },
      {
        deliver: async (m) => {
          messages.push(m);
        },
      },
    );
    const profiles = createProfileService(
      createProfileStore(pool),
      {
        deliver: async (m) => {
          invitations.push(m);
        },
      },
      invitationTokens,
    );
    const directory = path.join(fixture.directory, 'private-objects');
    const files = createLocalPrivateFiles(directory, secret),
      metadata = createPrivateObjectMetadata(pool),
      jobs = createDurableJobs(pool),
      accounts = createVerifiedAccounts(pool);
    let now = Date.now();
    const security = createPrivateObjectSecurity(secret, () => now);
    const objects = createPrivateObjects(
      profiles,
      metadata,
      files,
      security,
      origin,
    );
    const worker = createPrivateObjectWorker(
      jobs,
      accounts,
      profiles,
      metadata,
      files,
    );
    const server = createApiServer(
      createStatusService({
        check: async () => {
          await metadata.ready();
          await jobs.ready();
        },
        close: async () => {},
      }),
      {
        origin,
        handler: auth.handler,
        currentActor: auth.sessions.currentActor,
        profiles: createProfileController(profiles),
        storage: createPrivateObjectController(objects),
      },
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
    const call = (route, cookie, body, extra = {}) =>
      fetch(new URL(route, origin), {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin,
          ...(cookie ? { cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'manual',
      });
    const password = 'Synthetic storage password 381!';
    async function login(email) {
      const response = await call('/api/auth/sign-in/email', null, {
        email,
        password,
      });
      assert.equal(response.status, 200);
      return response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    }
    async function account(email) {
      assert.equal(
        (
          await call('/api/auth/sign-up/email', null, {
            email,
            name: 'Synthetic fixture',
            password,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await fetch(messages.findLast((m) => m.recipient === email).url, {
            redirect: 'manual',
          })
        ).status,
        302,
      );
      const cookie = await login(email);
      return { cookie, actor: await auth.sessions.currentActor({ cookie }) };
    }
    const alice = await account('storage-alice@example.test'),
      bob = await account('storage-bob@example.test');
    const a = (
      await (
        await call('/v1/profiles', alice.cookie, {
          displayName: 'Synthetic Alice',
        })
      ).json()
    ).profile;
    const b = (
      await (
        await call('/v1/profiles', alice.cookie, {
          displayName: 'Synthetic relative',
          kind: 'family',
        })
      ).json()
    ).profile;
    const c = (
      await (
        await call('/v1/profiles', bob.cookie, { displayName: 'Synthetic Bob' })
      ).json()
    ).profile;
    let refA = { profileId: a.id, revision: 1 };
    assert.equal(
      (
        await call('/v1/profile-context', alice.cookie, {
          profileId: a.id,
          expectedRevision: 0,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call('/v1/profile-context', bob.cookie, {
          profileId: c.id,
          expectedRevision: 0,
        })
      ).status,
      200,
    );
    const bytes = Buffer.from(
      'Synthetic private fixture A; no medical information',
    );
    const keyA = randomUUID();
    let objectA, objectB;
    async function newObject(text = 'Synthetic job object') {
      return objects.registerSynthetic(
        alice.actor,
        refA,
        Buffer.from(text),
        randomUUID(),
      );
    }
    const count = async (table) =>
      (await pool.query(`SELECT count(*) FROM ${table}`)).rows[0].count;
    const context = async (cookie) =>
      await (await call('/v1/profile-context', cookie)).json();
    const link = async (object, account = alice, ref = refA) =>
      call('/v1/storage/links', account.cookie, {
        objectId: object.id,
        context: ref,
      });
    const jobId = async (object) =>
      (
        await pool.query('SELECT id FROM platform_jobs WHERE object_id=$1', [
          object.id,
        ])
      ).rows[0].id;
    const status = async (id) =>
      (
        await pool.query(
          'SELECT state,attempts,last_error_code FROM platform_jobs WHERE id=$1',
          [id],
        )
      ).rows[0];
    await t.test(
      'encrypted, write-once objects and atomic idempotent metadata/outbox registration',
      async () => {
        objectA = await objects.registerSynthetic(
          alice.actor,
          refA,
          bytes,
          keyA,
        );
        const prior = await objects.registerSynthetic(
          alice.actor,
          refA,
          bytes,
          keyA,
        );
        assert.equal(prior.id, objectA.id);
        await assert.rejects(
          objects.registerSynthetic(
            alice.actor,
            refA,
            Buffer.from('Different fixture'),
            keyA,
          ),
          { code: 'IDEMPOTENCY_CONFLICT' },
        );
        const encrypted = await fs.readFile(
          path.join(directory, `${objectA.id}.bin`),
        );
        assert.equal(encrypted.includes(bytes), false);
        assert.equal(encrypted.subarray(0, 4).toString(), 'BVO1');
        assert.deepEqual(await files.read(objectA), bytes);
        await assert.rejects(files.write(objectA.id, a.id, bytes), {
          code: 'EEXIST',
        });
        await assert.rejects(files.write('../outside', a.id, bytes));
        await assert.rejects(
          objects.registerSynthetic(
            alice.actor,
            refA,
            new Uint8Array(MAX_PRIVATE_BYTES + 1),
            randomUUID(),
          ),
          { code: 'OBJECT_TOO_LARGE' },
        );
        assert.equal(await count('platform_private_objects'), '1');
        assert.equal(await count('platform_outbox'), '1');
        assert.equal(await count('platform_jobs'), '0');
        const switched = await profiles.select(alice.actor, {
          profileId: b.id,
          expectedRevision: 1,
        });
        objectB = await objects.registerSynthetic(
          alice.actor,
          { profileId: b.id, revision: switched.revision },
          Buffer.from('Synthetic fixture B'),
          randomUUID(),
        );
        const back = await profiles.select(alice.actor, {
          profileId: a.id,
          expectedRevision: switched.revision,
        });
        refA = { profileId: a.id, revision: back.revision };
      },
    );
    await t.test(
      'signed downloads require authentication, exact profile/session context and current permissions',
      async () => {
        const response = await link(objectA);
        assert.equal(response.status, 200);
        const signed = await response.json();
        const download = await call(signed.url, alice.cookie);
        assert.equal(download.status, 200);
        assert.match(
          download.headers.get('content-disposition'),
          /^attachment/,
        );
        assert.equal(download.headers.get('cache-control'), 'no-store');
        assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
        assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
        assert.equal((await call(signed.url)).status, 401);
        assert.equal((await call(signed.url, bob.cookie)).status, 404);
        assert.equal(
          (await call(signed.url, await login(alice.actor.email))).status,
          404,
        );
        assert.equal((await link(objectB)).status, 404);
        assert.equal(
          (await link(objectA, bob, { profileId: c.id, revision: 1 })).status,
          404,
        );
        assert.equal(
          (
            await call(
              '/v1/storage/links',
              alice.cookie,
              { objectId: objectA.id, context: refA },
              { origin: 'https://evil.example' },
            )
          ).status,
          403,
        );
        assert.equal(
          (await call('/private-objects/' + objectA.id + '.bin', alice.cookie))
            .status,
          404,
        );
        const other = new URL(signed.url);
        other.pathname = `/v1/storage/objects/${objectB.id}`;
        assert.equal((await call(other.href, alice.cookie)).status, 404);
        now += 61000;
        assert.equal((await call(signed.url, alice.cookie)).status, 404);
        now = Date.now();
        const fresh = await (await link(objectA)).json();
        const switched = await profiles.select(alice.actor, {
          profileId: b.id,
          expectedRevision: refA.revision,
        });
        assert.equal((await call(fresh.url, alice.cookie)).status, 409);
        const back = await profiles.select(alice.actor, {
          profileId: a.id,
          expectedRevision: switched.revision,
        });
        refA = { profileId: a.id, revision: back.revision };
        assert.equal((await call(fresh.url, alice.cookie)).status, 409);
      },
    );
    await t.test(
      'authentication tags, profile AAD and stored digests reject tampering before returning bytes',
      async () => {
        const filename = path.join(directory, `${objectA.id}.bin`),
          original = await fs.readFile(filename);
        const corrupt = Buffer.from(original);
        corrupt[corrupt.length - 1] ^= 1;
        await fs.writeFile(filename, corrupt);
        await assert.rejects(files.read(objectA), {
          code: 'INTEGRITY_FAILURE',
        });
        const signed = await (await link(objectA)).json();
        assert.equal((await call(signed.url, alice.cookie)).status, 404);
        await fs.writeFile(
          filename,
          await fs.readFile(path.join(directory, `${objectB.id}.bin`)),
        );
        await assert.rejects(files.read(objectA), {
          code: 'INTEGRITY_FAILURE',
        });
        await fs.writeFile(filename, original);
        await assert.rejects(
          createLocalPrivateFiles(
            directory,
            randomBytes(32).toString('hex'),
          ).read(objectA),
          { code: 'INTEGRITY_FAILURE' },
        );
        await assert.rejects(
          files.read({ ...objectA, sha256: 'f'.repeat(64) }),
          { code: 'INTEGRITY_FAILURE' },
        );
        assert.deepEqual(await files.read(objectA), bytes);
      },
    );
    await t.test(
      'an outbox failure rolls metadata back and removes only the new private file',
      async () => {
        const before = (await fs.readdir(directory)).sort();
        await pool.query(
          "CREATE FUNCTION fixture_reject_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.idempotency_key='00000000-0000-4000-8000-000000000099'::uuid THEN RAISE EXCEPTION 'synthetic outbox failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fixture_reject BEFORE INSERT ON platform_outbox FOR EACH ROW EXECUTE FUNCTION fixture_reject_outbox()",
        );
        try {
          await assert.rejects(
            objects.registerSynthetic(
              alice.actor,
              refA,
              Buffer.from('Synthetic rollback fixture'),
              '00000000-0000-4000-8000-000000000099',
            ),
            /synthetic outbox failure/,
          );
          assert.deepEqual((await fs.readdir(directory)).sort(), before);
          assert.equal(
            (
              await pool.query(
                "SELECT count(*) FROM platform_private_objects WHERE request_key='00000000-0000-4000-8000-000000000099'",
              )
            ).rows[0].count,
            '0',
          );
        } finally {
          await pool.query(
            'DROP TRIGGER fixture_reject ON platform_outbox; DROP FUNCTION fixture_reject_outbox()',
          );
        }
      },
    );
    await t.test(
      'concurrent protected storage calls share a connection and reject mixed-profile transactions',
      async () => {
        const responses = await Promise.all(
          Array.from({ length: 12 }, () =>
            objects.link(alice.actor, { objectId: objectA.id, context: refA }),
          ),
        );
        assert.equal(responses.length, 12);
        await assert.rejects(
          profiles.withAccess(
            alice.actor,
            a.id,
            { category: 'health', action: 'read', purpose: 'care' },
            async () => metadata.find(b.id, objectB.id),
          ),
          /Transaction profile mismatch/,
        );
      },
    );
    await t.test(
      'authorization audit, metadata and outbox roll back together after file persistence',
      async () => {
        const before = (await fs.readdir(directory)).sort();
        const requestKey = '00000000-0000-4000-8000-000000000098';
        await pool.query(
          "CREATE FUNCTION fixture_reject_object_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event='access.health.write' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END; $$; CREATE TRIGGER fixture_reject_object_audit BEFORE INSERT ON identity_profile_audit FOR EACH ROW EXECUTE FUNCTION fixture_reject_object_audit()",
        );
        try {
          await assert.rejects(
            objects.registerSynthetic(
              alice.actor,
              refA,
              Buffer.from('Synthetic audit rollback'),
              requestKey,
            ),
            /synthetic audit failure/,
          );
          assert.deepEqual((await fs.readdir(directory)).sort(), before);
          assert.equal(
            (
              await pool.query(
                'SELECT count(*) FROM platform_private_objects WHERE request_key=$1',
                [requestKey],
              )
            ).rows[0].count,
            '0',
          );
          assert.equal(
            (
              await pool.query(
                'SELECT count(*) FROM platform_outbox WHERE idempotency_key=$1',
                [requestKey],
              )
            ).rows[0].count,
            '0',
          );
        } finally {
          await pool.query(
            'DROP TRIGGER fixture_reject_object_audit ON identity_profile_audit; DROP FUNCTION fixture_reject_object_audit()',
          );
        }
      },
    );
    await t.test(
      'concurrent outbox delivery and workers are replay-safe with one receipt per job',
      async () => {
        const dispatched = await Promise.all([
          jobs.dispatch(),
          jobs.dispatch(),
        ]);
        assert.equal(
          dispatched.reduce((x, y) => x + y, 0),
          2,
        );
        assert.equal(await count('platform_jobs'), '2');
        const results = await Promise.all([worker.runOnce(), worker.runOnce()]);
        assert.ok(results.every((value) => value.status === 'succeeded'));
        assert.equal(await count('platform_job_receipts'), '2');
        assert.equal((await worker.runOnce()).status, 'idle');
        await pool.query(
          'UPDATE platform_outbox SET dispatched_at=NULL WHERE object_id=$1',
          [objectA.id],
        );
        assert.equal(await jobs.dispatch(), 1);
        assert.equal((await worker.runOnce()).status, 'idle');
        assert.equal(await count('platform_job_receipts'), '2');
        const id = await jobId(objectA);
        assert.equal(
          (
            await call(
              `/v1/storage/jobs/${id}?profileId=${a.id}&revision=${refA.revision}`,
              alice.cookie,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await call(
              `/v1/storage/jobs/${await jobId(objectB)}?profileId=${a.id}&revision=${refA.revision}`,
              alice.cookie,
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await call(
              `/v1/storage/jobs/${id}?profileId=${c.id}&revision=1`,
              bob.cookie,
            )
          ).status,
          404,
        );
      },
    );
    await t.test(
      'expired leases are reclaimed and stale completion/failure tokens cannot mutate a new attempt',
      async () => {
        const object = await newObject();
        await jobs.dispatch();
        const first = await jobs.claim();
        assert.equal(first.objectId, object.id);
        await pool.query(
          "UPDATE platform_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
          [first.id],
        );
        const next = await jobs.claim();
        assert.equal(next.id, first.id);
        assert.notEqual(next.leaseToken, first.leaseToken);
        assert.equal(next.attempts, 2);
        assert.equal(await jobs.complete(first, object.sha256), false);
        assert.equal(await jobs.fail(first, 'RETRYABLE_FAILURE'), false);
        await assert.rejects(
          jobs.complete(next, 'f'.repeat(64)),
          /Receipt integrity mismatch/,
        );
        assert.equal(await jobs.complete(next, object.sha256), true);
        assert.equal(await jobs.complete(next, object.sha256), false);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*) FROM platform_job_receipts WHERE job_id=$1',
              [first.id],
            )
          ).rows[0].count,
          '1',
        );
        const exhausted = await newObject();
        await jobs.dispatch();
        await pool.query(
          'UPDATE platform_jobs SET max_attempts=1 WHERE object_id=$1',
          [exhausted.id],
        );
        const last = await jobs.claim();
        await pool.query(
          "UPDATE platform_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
          [last.id],
        );
        assert.equal(await jobs.claim(), null);
        assert.equal((await status(last.id)).state, 'failed');
      },
    );
    await t.test(
      'transient failures back off then succeed; bounded retries terminate without raw errors',
      async () => {
        const object = await newObject();
        let reads = 0;
        const flaky = createPrivateObjectWorker(
          jobs,
          accounts,
          profiles,
          metadata,
          {
            ...files,
            read: async (value) => {
              if (reads++ === 0)
                throw new PrivateObjectError('OBJECT_UNAVAILABLE');
              return files.read(value);
            },
          },
        );
        assert.equal((await flaky.runOnce()).status, 'retry_scheduled');
        const id = await jobId(object);
        assert.equal((await flaky.runOnce()).status, 'idle');
        await pool.query(
          'UPDATE platform_jobs SET available_at=now() WHERE id=$1',
          [id],
        );
        assert.equal((await flaky.runOnce()).status, 'succeeded');
        assert.equal((await status(id)).attempts, 2);
        const bad = await newObject();
        const failing = createPrivateObjectWorker(
          jobs,
          accounts,
          profiles,
          metadata,
          {
            ...files,
            read: async () => {
              throw Error('synthetic sensitive exception; never persist');
            },
          },
        );
        for (let attempt = 1; attempt <= 3; attempt++) {
          const outcome = await failing.runOnce();
          assert.equal(
            outcome.status,
            attempt === 3 ? 'failed' : 'retry_scheduled',
          );
          const badId = await jobId(bad);
          if (attempt < 3)
            await pool.query(
              'UPDATE platform_jobs SET available_at=now() WHERE id=$1',
              [badId],
            );
        }
        assert.equal(
          (await status(await jobId(bad))).last_error_code,
          'RETRYABLE_FAILURE',
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*) FROM platform_job_receipts WHERE object_id=$1',
              [bad.id],
            )
          ).rows[0].count,
          '0',
        );
      },
    );
    await t.test(
      'revocation blocks existing signed links and pending jobs using current profile policy',
      async () => {
        await profiles.consent(alice.actor, a.id, {
          purpose: 'family_sharing',
          granted: true,
          noticeVersion: 'pilot-v1',
        });
        await profiles.invite(alice.actor, a.id, {
          email: bob.actor.email,
          role: 'caregiver',
          scopes: [
            { category: 'profile', action: 'read', purpose: 'care' },
            { category: 'health', action: 'read', purpose: 'care' },
            { category: 'health', action: 'write', purpose: 'care' },
          ],
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });
        const grant = await profiles.accept(bob.actor, {
          token: invitations.at(-1).token,
        });
        const selected = await profiles.select(bob.actor, {
          profileId: a.id,
          expectedRevision: 1,
        });
        const ref = { profileId: a.id, revision: selected.revision };
        const object = await objects.registerSynthetic(
          bob.actor,
          ref,
          Buffer.from('Synthetic caregiver fixture'),
          randomUUID(),
        );
        const signed = await (await link(object, bob, ref)).json();
        await profiles.revoke(alice.actor, a.id, grant.grantId);
        assert.equal((await call(signed.url, bob.cookie)).status, 404);
        assert.equal((await worker.runOnce()).status, 'cancelled');
        assert.equal(
          (await status(await jobId(object))).last_error_code,
          'ACCESS_REVOKED',
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*) FROM platform_job_receipts WHERE object_id=$1',
              [object.id],
            )
          ).rows[0].count,
          '0',
        );
        assert.equal((await context(bob.cookie)).profile, null);
      },
    );
    await t.test(
      'jobs recheck verified account state without borrowing a browser session',
      async () => {
        const object = await newObject();
        await pool.query(
          'UPDATE identity_user SET "emailVerified"=false WHERE id=$1',
          [alice.actor.id],
        );
        try {
          assert.equal((await worker.runOnce()).status, 'cancelled');
          assert.equal(
            (await status(await jobId(object))).last_error_code,
            'ACCESS_REVOKED',
          );
        } finally {
          await pool.query(
            'UPDATE identity_user SET "emailVerified"=true WHERE id=$1',
            [alice.actor.id],
          );
        }
      },
    );
    await t.test(
      'private metadata and event foreign keys enforce profile/actor boundaries; RLS also isolates rows',
      async () => {
        await assert.rejects(
          pool.query(
            "INSERT INTO platform_outbox(id,profile_id,actor_id,object_id,event_type,trace_id,idempotency_key) VALUES($1,$2,$3,$4,'platform.private_object.stored.v1',$5,$6)",
            [
              randomUUID(),
              a.id,
              alice.actor.id,
              objectB.id,
              randomUUID(),
              randomUUID(),
            ],
          ),
          { code: '23503' },
        );
        await assert.rejects(
          pool.query(
            "INSERT INTO platform_outbox(id,profile_id,actor_id,object_id,event_type,trace_id,idempotency_key) VALUES($1,$2,$3,$4,'platform.private_object.stored.v1',$5,$6)",
            [
              randomUUID(),
              a.id,
              bob.actor.id,
              objectA.id,
              randomUUID(),
              randomUUID(),
            ],
          ),
          { code: '23503' },
        );
        await assert.rejects(
          pool.query(
            'UPDATE platform_private_objects SET byte_length=1 WHERE id=$1',
            [objectA.id],
          ),
          { code: '55000' },
        );
        await pool.query(
          'CREATE ROLE platform_fixture_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS',
        );
        await pool.query(
          'GRANT SELECT,INSERT ON platform_private_objects TO platform_fixture_runtime',
        );
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SET LOCAL ROLE platform_fixture_runtime');
          assert.equal(
            (
              await client.query(
                'SELECT count(*) FROM platform_private_objects',
              )
            ).rows[0].count,
            '0',
          );
          await client.query(
            "SELECT set_config('biovitai.profile_id',$1,true)",
            [a.id],
          );
          const rows = (
            await client.query(
              'SELECT profile_id FROM platform_private_objects',
            )
          ).rows;
          assert.ok(rows.length > 0);
          assert.ok(rows.every((row) => row.profile_id === a.id));
          await assert.rejects(
            client.query(
              'INSERT INTO platform_private_objects(id,profile_id,actor_id,request_key,content_sha256,byte_length) VALUES($1,$2,$3,$4,$5,1)',
              [
                randomUUID(),
                b.id,
                alice.actor.id,
                randomUUID(),
                'a'.repeat(64),
              ],
            ),
            { code: '42501' },
          );
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
      },
    );
  },
);
