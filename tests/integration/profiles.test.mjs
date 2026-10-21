import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { postgresFixture, freePort } from '../helpers/postgres.mjs';
import { migrateDatabase } from '../../dist/infrastructure/db/migrations.js';
import { createIdentityAuth } from '../../dist/modules/identity/src/infrastructure/auth.js';
import {
  createProfileStore,
  invitationTokens,
} from '../../dist/modules/identity/src/infrastructure/profiles.js';
import { createProfileService } from '../../dist/modules/identity/src/application/profiles.js';
import { createProfileController } from '../../dist/apps/api/src/controllers/profiles.js';
import { createApiServer } from '../../dist/infrastructure/http/server.js';
import { createStatusService } from '../../dist/apps/api/src/application/status.js';
import {
  CurrentAccountSchema,
  ProfileListSchema,
  ProfileContextSchema,
  PublicProfileSchema,
} from '../../dist/shared/contracts/src/web.js';

test(
  'profile authorization and consent on PostgreSQL and HTTP',
  { timeout: 120000 },
  async (t) => {
    const fixture = await postgresFixture();
    t.after(() => fixture.close());
    await t.test(
      'managed-profile migration preserves existing self profile, consent and audit identity',
      async () => {
        const prior = path.join(fixture.directory, 'prior-migrations');
        await fs.mkdir(prior);
        for (const file of ['0001_identity.sql', '0002_profile_access.sql'])
          await fs.copyFile(
            path.resolve('infrastructure/db/migrations', file),
            path.join(prior, file),
          );
        await migrateDatabase(fixture.pool, prior);
        const legacyActor = randomUUID();
        const legacyId = randomUUID();
        await fixture.pool.query(
          'INSERT INTO identity_user(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())',
          [legacyActor, 'Synthetic legacy account', 'legacy@example.test'],
        );
        await fixture.pool.query(
          'INSERT INTO identity_profile(id,owner_id,display_name) VALUES($1,$2,$3)',
          [legacyId, legacyActor, 'Synthetic legacy profile'],
        );
        await fixture.pool.query(
          "INSERT INTO identity_consent(profile_id,actor_id,purpose,notice_version,granted) VALUES($1,$2,'family_sharing','pilot-v1',true)",
          [legacyId, legacyActor],
        );
        await fixture.pool.query(
          "INSERT INTO identity_profile_audit(profile_id,actor_id,event) VALUES($1,$2,'profile.created')",
          [legacyId, legacyActor],
        );
        await migrateDatabase(
          fixture.pool,
          path.resolve('infrastructure/db/migrations'),
        );
        await migrateDatabase(
          fixture.pool,
          path.resolve('infrastructure/db/migrations'),
        );
        assert.deepEqual(
          (
            await fixture.pool.query(
              'SELECT id,owner_id,display_name,kind,contact_email FROM identity_profile WHERE id=$1',
              [legacyId],
            )
          ).rows[0],
          {
            id: legacyId,
            owner_id: legacyActor,
            display_name: 'Synthetic legacy profile',
            kind: 'self',
            contact_email: null,
          },
        );
        assert.equal(
          (
            await fixture.pool.query(
              'SELECT granted FROM identity_consent WHERE profile_id=$1',
              [legacyId],
            )
          ).rows[0].granted,
          true,
        );
        assert.equal(
          (
            await fixture.pool.query(
              'SELECT event FROM identity_profile_audit WHERE profile_id=$1',
              [legacyId],
            )
          ).rows[0].event,
          'profile.created',
        );
      },
    );
    const messages = [];
    const captures = [];
    const origin = `http://127.0.0.1:${await freePort()}`;
    const auth = createIdentityAuth(
      fixture.pool,
      { origin, secret: randomBytes(32).toString('hex') },
      {
        deliver: async (m) => {
          messages.push(m);
        },
      },
    );
    const store = createProfileStore(fixture.pool);
    const service = createProfileService(
      store,
      {
        deliver: async (m) => {
          captures.push(m);
        },
      },
      invitationTokens,
    );
    const server = createApiServer(
      createStatusService({
        check: async () => {
          await auth.ready();
          await store.ready();
        },
        close: async () => {},
      }),
      {
        origin,
        handler: auth.handler,
        currentActor: auth.sessions.currentActor,
        profiles: createProfileController(service),
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
    const call = (route, cookie, body, headers = {}) =>
      fetch(`${origin}${route}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin,
          ...(cookie ? { cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'manual',
      });
    async function account(email) {
      const password = 'Synthetic Profile password 381!';
      assert.equal(
        (
          await call('/api/auth/sign-up/email', null, {
            email,
            name: 'Synthetic person',
            password,
          })
        ).status,
        200,
      );
      const message = messages.findLast(
        (m) => m.recipient === email && m.kind === 'verification',
      );
      assert.ok(message);
      assert.equal(
        (await fetch(message.url, { redirect: 'manual' })).status,
        302,
      );
      const login = await call('/api/auth/sign-in/email', null, {
        email,
        password,
      });
      assert.equal(login.status, 200);
      const cookie = login.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      const actor = await auth.sessions.currentActor({ cookie });
      assert.ok(actor);
      return { cookie, actor };
    }
    const alice = await account('profile-alice@example.test');
    const bob = await account('profile-bob@example.test');
    const eve = await account('profile-eve@example.test');
    let profile;
    const scope = { category: 'profile', action: 'read', purpose: 'care' };
    const health = { category: 'health', action: 'read', purpose: 'care' };
    const inviteBody = (overrides = {}) => ({
      email: bob.actor.email,
      role: 'viewer',
      scopes: [scope, health],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      ...overrides,
    });
    const consent = (purpose, granted = true) =>
      call(`/v1/profiles/${profile.id}/consents`, alice.cookie, {
        purpose,
        granted,
        noticeVersion: 'pilot-v1',
      });
    const invite = () =>
      call(
        `/v1/profiles/${profile.id}/invitations`,
        alice.cookie,
        inviteBody(),
      );
    const accept = (token) =>
      call('/v1/profile-invitations/accept', bob.cookie, { token });
    await t.test(
      'self profiles are distinct; caller IDs and roles cannot override session identity',
      async () => {
        assert.equal(
          (await call('/v1/profiles', null, { displayName: 'Synthetic' }))
            .status,
          401,
        );
        assert.equal(
          (
            await call('/v1/profiles', alice.cookie, {
              displayName: 'Synthetic',
              ownerId: bob.actor.id,
            })
          ).status,
          400,
        );
        const response = await call('/v1/profiles', alice.cookie, {
          displayName: 'Synthetic Alice',
        });
        assert.equal(response.status, 201);
        profile = (await response.json()).profile;
        assert.notEqual(profile.id, alice.actor.id);
        assert.equal(profile.ownerId, alice.actor.id);
        assert.equal(
          (await call('/v1/profiles', alice.cookie, { displayName: 'Again' }))
            .status,
          409,
        );
        assert.equal(
          (
            await call(
              `/v1/profiles/${profile.id}?actorId=${alice.actor.id}&role=owner`,
              bob.cookie,
            )
          ).status,
          404,
        );
        assert.equal(
          (await call(`/v1/profiles/${randomUUID()}`, bob.cookie)).status,
          404,
        );
        assert.deepEqual(
          (await (await call('/v1/profiles', bob.cookie)).json()).profiles,
          [],
        );
        assert.equal((await invite()).status, 403);
        assert.equal(
          (
            await call(`/v1/profiles/${profile.id}/consents`, bob.cookie, {
              purpose: 'family_sharing',
              granted: true,
              noticeVersion: 'pilot-v1',
            })
          ).status,
          404,
        );
      },
    );
    let grantId;
    await t.test(
      'real HTTP responses conform to exact public contracts and omit private contact data',
      async () => {
        assert.equal(
          (
            await call(`/v1/profiles/${profile.id}/contact`, alice.cookie, {
              email: 'private-contact@example.test',
            })
          ).status,
          200,
        );
        const accountResponse = await (
          await call('/v1/me', alice.cookie)
        ).json();
        assert.equal(
          CurrentAccountSchema.parse(accountResponse).actor.id,
          alice.actor.id,
        );
        const list = await (await call('/v1/profiles', alice.cookie)).json();
        assert.equal(
          ProfileListSchema.parse(list).profiles.some(
            (item) => item.id === profile.id,
          ),
          true,
        );
        const read = await (
          await call(`/v1/profiles/${profile.id}`, alice.cookie)
        ).json();
        assert.deepEqual(PublicProfileSchema.parse(read.profile), profile);
        ProfileContextSchema.parse(
          await (await call('/v1/profile-context', alice.cookie)).json(),
        );
        for (const cookie of [undefined, eve.cookie]) {
          for (const route of [
            `/v1/profiles/${profile.id}/contact`,
            `/v1/profiles/${profile.id}/consents`,
            `/v1/profiles/${profile.id}/sharing`,
            `/v1/profiles/${profile.id}/audit`,
          ]) {
            const response = await call(route, cookie);
            assert.equal(response.status, cookie ? 404 : 401);
            assert.deepEqual(await response.json(), {
              error: { code: cookie ? 'PROFILE_NOT_FOUND' : 'UNAUTHENTICATED' },
            });
          }
        }
      },
    );
    await t.test(
      'explicit sharing consent plus intended verified recipient acceptance activates precise scopes',
      async () => {
        assert.equal((await consent('family_sharing')).status, 200);
        assert.equal(
          (
            await call(
              `/v1/profiles/${profile.id}/invitations`,
              alice.cookie,
              inviteBody({ scopes: [{ ...scope, action: 'write' }] }),
            )
          ).status,
          400,
        );
        assert.equal((await invite()).status, 201);
        const capture = captures.at(-1);
        assert.ok(capture.token);
        const stored = (
          await fixture.pool.query(
            'SELECT token_hash FROM identity_profile_invitation WHERE id=$1',
            [capture.invitationId],
          )
        ).rows[0];
        assert.notEqual(stored.token_hash, capture.token);
        assert.equal(
          (await call(`/v1/profiles/${profile.id}`, bob.cookie)).status,
          404,
        );
        assert.equal(
          (
            await call('/v1/profile-invitations/accept', eve.cookie, {
              token: capture.token,
            })
          ).status,
          404,
        );
        const response = await accept(capture.token);
        assert.equal(response.status, 200);
        grantId = (await response.json()).grantId;
        const sharing = (
          await (
            await call(`/v1/profiles/${profile.id}/sharing`, alice.cookie)
          ).json()
        ).sharing;
        assert.equal(sharing[0].grantId, grantId);
        assert.equal('token' in sharing[0], false);
        assert.equal('token_hash' in sharing[0], false);
        assert.equal(
          (await call(`/v1/profiles/${profile.id}/sharing`, bob.cookie)).status,
          404,
        );
        assert.equal((await accept(capture.token)).status, 404);
        assert.equal(
          (await call(`/v1/profiles/${profile.id}`, bob.cookie)).status,
          200,
        );
        assert.equal((await call('/v1/profiles', bob.cookie)).status, 200);
        assert.equal(
          (
            await call(
              `/v1/profiles/${profile.id}?purpose=wellness`,
              bob.cookie,
            )
          ).status,
          404,
        );
        assert.equal(
          (await call(`/v1/profiles/${profile.id}/audit`, bob.cookie)).status,
          404,
        );
        let runs = 0;
        await service.withAccess(bob.actor, profile.id, health, async () => {
          runs++;
        });
        await assert.rejects(
          service.withAccess(
            bob.actor,
            profile.id,
            { ...health, action: 'write' },
            async () => {
              runs++;
            },
          ),
          { code: 'PROFILE_NOT_FOUND' },
        );
        await assert.rejects(
          service.withAccess(
            bob.actor,
            profile.id,
            health,
            async () => {
              runs++;
            },
            'health_ai',
          ),
          { code: 'CONSENT_REQUIRED' },
        );
        assert.equal(runs, 1);
      },
    );
    await t.test(
      'a shared viewer cannot read private manager metadata or escalate via owner-only writes',
      async () => {
        const mutations = [
          [
            `/v1/profiles/${profile.id}/contact`,
            { email: 'attacker@example.test' },
          ],
          [
            `/v1/profiles/${profile.id}/consents`,
            { purpose: 'health_ai', granted: true, noticeVersion: 'pilot-v1' },
          ],
          [
            `/v1/profiles/${profile.id}/invitations`,
            inviteBody({ email: eve.actor.email }),
          ],
          [`/v1/profiles/${profile.id}/sharing/${grantId}/revoke`, {}],
        ];
        for (const [route, body] of mutations) {
          const response = await call(route, bob.cookie, body);
          assert.equal(response.status, 404);
          assert.deepEqual(await response.json(), {
            error: { code: 'PROFILE_NOT_FOUND' },
          });
        }
        for (const resource of ['contact', 'consents', 'sharing', 'audit'])
          assert.equal(
            (await call(`/v1/profiles/${profile.id}/${resource}`, bob.cookie))
              .status,
            404,
          );
        assert.deepEqual(
          await (
            await call(`/v1/profiles/${profile.id}/contact`, alice.cookie)
          ).json(),
          { email: 'private-contact@example.test' },
        );
        assert.equal(
          (await call(`/v1/profiles/${profile.id}`, bob.cookie)).status,
          200,
        );
      },
    );
    await t.test(
      'AI and wellness consent stay separate; withdrawal is recorded and enforced',
      async () => {
        const cross = {
          category: 'health',
          action: 'read',
          purpose: 'wellness',
        };
        await assert.rejects(
          service.withAccess(alice.actor, profile.id, cross, async () => true),
          { code: 'CONSENT_REQUIRED' },
        );
        await consent('health_ai');
        assert.equal(
          await service.withAccess(
            bob.actor,
            profile.id,
            health,
            async () => true,
            'health_ai',
          ),
          true,
        );
        await assert.rejects(
          service.withAccess(alice.actor, profile.id, cross, async () => true),
          { code: 'CONSENT_REQUIRED' },
        );
        await consent('health_to_wellness');
        assert.equal(
          await service.withAccess(
            alice.actor,
            profile.id,
            cross,
            async () => true,
          ),
          true,
        );
        await consent('health_ai', false);
        await assert.rejects(
          service.withAccess(
            bob.actor,
            profile.id,
            health,
            async () => true,
            'health_ai',
          ),
          { code: 'CONSENT_REQUIRED' },
        );
        const history = (
          await (
            await call(`/v1/profiles/${profile.id}/consents`, alice.cookie)
          ).json()
        ).consents;
        assert.deepEqual(
          history
            .filter((x) => x.purpose === 'health_ai')
            .map((x) => x.granted),
          [false, true],
        );
        assert.equal(
          (
            await call(`/v1/profiles/${profile.id}/consents`, alice.cookie, {
              purpose: 'all',
              granted: true,
              noticeVersion: 'pilot-v1',
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'revocation waits for active protected operation then denies reuse with same session',
      async () => {
        let entered, release;
        const started = new Promise((resolve) => {
          entered = resolve;
        });
        const hold = new Promise((resolve) => {
          release = resolve;
        });
        const read = service.withAccess(
          bob.actor,
          profile.id,
          health,
          async () => {
            entered();
            await hold;
            return true;
          },
        );
        await started;
        let revoked = false;
        const revoke = service
          .revoke(alice.actor, profile.id, grantId)
          .then(() => {
            revoked = true;
          });
        // Verify an independent transaction cannot acquire the held profile lock.
        const client = await fixture.pool.connect();
        try {
          await client.query('BEGIN');
          await assert.rejects(
            client.query(
              'SELECT id FROM identity_profile WHERE id=$1 FOR UPDATE NOWAIT',
              [profile.id],
            ),
            { code: '55P03' },
          );
          await client.query('ROLLBACK');
        } finally {
          client.release();
          release();
        }
        assert.equal(await read, true);
        await revoke;
        assert.equal(revoked, true);
        const freshPolicy = createProfileService(
          createProfileStore(fixture.pool),
          { deliver: async () => {} },
          invitationTokens,
        );
        await assert.rejects(
          freshPolicy.withAccess(
            bob.actor,
            profile.id,
            health,
            async () => true,
          ),
          { code: 'PROFILE_NOT_FOUND' },
        );
        assert.equal(
          (await call(`/v1/profiles/${profile.id}`, bob.cookie)).status,
          404,
        );
        await assert.rejects(
          service.withAccess(bob.actor, profile.id, health, async () => true),
          { code: 'PROFILE_NOT_FOUND' },
        );
      },
    );
    await t.test(
      'family withdrawal cancels pending invitations and grants; reconsent cannot resurrect access',
      async () => {
        await invite();
        const active = captures.at(-1);
        assert.equal((await accept(active.token)).status, 200);
        await invite();
        const pending = captures.at(-1);
        await consent('family_sharing', false);
        assert.equal(
          (await call(`/v1/profiles/${profile.id}`, bob.cookie)).status,
          404,
        );
        await consent('family_sharing');
        assert.equal((await accept(pending.token)).status, 404);
        assert.equal(
          (await call(`/v1/profiles/${profile.id}`, bob.cookie)).status,
          404,
        );
        assert.deepEqual(
          (await (await call('/v1/profiles', bob.cookie)).json()).profiles,
          [],
        );
      },
    );
    await t.test(
      'expired invitations/grants, replay races, and resource substitution fail closed',
      async () => {
        await invite();
        let capture = captures.at(-1);
        await fixture.pool.query(
          "UPDATE identity_profile_invitation SET expires_at=now()-interval '1 minute' WHERE id=$1",
          [capture.invitationId],
        );
        assert.equal((await accept(capture.token)).status, 404);
        await invite();
        capture = captures.at(-1);
        const attempts = await Promise.all([
          accept(capture.token),
          accept(capture.token),
        ]);
        assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 404]);
        await fixture.pool.query(
          "UPDATE identity_profile_grant SET expires_at=now()-interval '1 minute' WHERE invitation_id=$1",
          [capture.invitationId],
        );
        assert.equal(
          (await call(`/v1/profiles/${profile.id}`, bob.cookie)).status,
          404,
        );
        const bobProfile = (
          await (
            await call('/v1/profiles', bob.cookie, {
              displayName: 'Synthetic Bob',
            })
          ).json()
        ).profile;
        assert.equal(
          (
            await call(
              `/v1/profiles/${bobProfile.id}/sharing/${capture.invitationId}/revoke`,
              alice.cookie,
              {},
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await call(
              `/v1/profiles/${profile.id}/sharing/${randomUUID()}/revoke`,
              alice.cookie,
              {},
            )
          ).status,
          404,
        );
        assert.equal(
          (
            await call(
              `/v1/profiles/${profile.id}/invitations`,
              alice.cookie,
              inviteBody(),
              { origin: 'https://evil.example' },
            )
          ).status,
          403,
        );
        const events = (
          await (
            await call(`/v1/profiles/${profile.id}/audit`, alice.cookie)
          ).json()
        ).events;
        assert.ok(events.some((x) => x.event === 'sharing.revoked'));
        assert.ok(events.some((x) => x.event === 'consent.withdrawn'));
        assert.ok(!JSON.stringify(events).includes(capture.token));
        assert.ok(!JSON.stringify(events).includes(bob.actor.email));
        assert.ok(!JSON.stringify(events).includes(profile.displayName));
        const failing = createProfileService(
          store,
          {
            deliver: async () => {
              throw Error('synthetic capture failure');
            },
          },
          invitationTokens,
        );
        await assert.rejects(
          failing.invite(alice.actor, profile.id, inviteBody()),
          /capture failure/,
        );
        assert.equal(
          (
            await fixture.pool.query(
              'SELECT count(*) FROM identity_profile_invitation WHERE revoked_at IS NULL AND accepted_at IS NULL AND expires_at>now() AND profile_id=$1',
              [profile.id],
            )
          ).rows[0].count,
          '0',
        );
      },
    );
    let father;
    let mother;
    let selected;
    await t.test(
      'multiple managed family profiles need no email; contact email alone grants no access',
      async () => {
        const before = captures.length;
        const createFamily = async (displayName) => {
          const response = await call('/v1/profiles', alice.cookie, {
            displayName,
            kind: 'family',
          });
          assert.equal(response.status, 201);
          return (await response.json()).profile;
        };
        father = await createFamily('Synthetic Father');
        mother = await createFamily('Synthetic Mother');
        assert.notEqual(father.id, mother.id);
        assert.equal(father.kind, 'family');
        assert.equal(father.ownerId, alice.actor.id);
        assert.equal(captures.length, before);
        assert.deepEqual(
          await (
            await call(`/v1/profiles/${father.id}/contact`, alice.cookie)
          ).json(),
          { email: null },
        );
        assert.equal(
          (
            await call(`/v1/profiles/${father.id}/contact`, alice.cookie, {
              email: bob.actor.email,
            })
          ).status,
          200,
        );
        assert.deepEqual(
          await (
            await call(`/v1/profiles/${father.id}/contact`, alice.cookie)
          ).json(),
          { email: bob.actor.email },
        );
        assert.equal(
          (await call(`/v1/profiles/${father.id}`, bob.cookie)).status,
          404,
        );
        assert.equal(
          (await call(`/v1/profiles/${father.id}/contact`, bob.cookie)).status,
          404,
        );
        assert.equal(
          (
            await call(`/v1/profiles/${father.id}/contact`, bob.cookie, {
              email: eve.actor.email,
            })
          ).status,
          404,
        );
        const profiles = (
          await (await call('/v1/profiles', alice.cookie)).json()
        ).profiles;
        assert.ok(profiles.some((p) => p.id === father.id));
        assert.ok(profiles.some((p) => p.id === mother.id));
        assert.ok(profiles.every((p) => !('contactEmail' in p)));
        assert.equal(
          (
            await call(`/v1/profiles/${father.id}/contact`, alice.cookie, {
              email: null,
            })
          ).status,
          200,
        );
        assert.equal(
          (await call(`/v1/profiles/${father.id}`, alice.cookie)).status,
          200,
        );
        assert.equal(
          (
            await call('/v1/profiles', alice.cookie, {
              displayName: 'Unknown kind',
              kind: 'guardian',
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'active profile is session-bound, persistent and independent of login identity',
      async () => {
        assert.deepEqual(
          await (await call('/v1/profile-context', alice.cookie)).json(),
          { profile: null, revision: 0 },
        );
        const response = await call('/v1/profile-context', alice.cookie, {
          profileId: father.id,
          expectedRevision: 0,
        });
        assert.equal(response.status, 200);
        selected = ProfileContextSchema.parse(await response.json());
        assert.equal(selected.profile.id, father.id);
        assert.equal(selected.revision, 1);
        const me = (await (await call('/v1/me', alice.cookie)).json()).actor;
        assert.equal(me.id, alice.actor.id);
        assert.equal('sessionId' in me, false);
        const fresh = createProfileService(
          createProfileStore(fixture.pool),
          { deliver: async () => {} },
          invitationTokens,
        );
        assert.equal((await fresh.current(alice.actor)).profile.id, father.id);
        assert.deepEqual(
          await (await call('/v1/profile-context', bob.cookie)).json(),
          { profile: null, revision: 0 },
        );
        await assert.rejects(
          service.current({ ...alice.actor, id: bob.actor.id }),
          { code: 'UNAUTHENTICATED' },
        );
        const otherLogin = await call('/api/auth/sign-in/email', null, {
          email: alice.actor.email,
          password: 'Synthetic Profile password 381!',
        });
        const otherCookie = otherLogin.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; ');
        assert.deepEqual(
          await (await call('/v1/profile-context', otherCookie)).json(),
          { profile: null, revision: 0 },
        );
        assert.equal(
          (
            await call('/v1/profile-context', alice.cookie, {
              profileId: father.id,
              expectedRevision: 1,
              actorId: bob.actor.id,
            })
          ).status,
          400,
        );
        const bobProfile = (
          await (await call('/v1/profiles', bob.cookie)).json()
        ).profiles.find((p) => p.ownerId === bob.actor.id);
        assert.equal(
          (
            await call('/v1/profile-context', alice.cookie, {
              profileId: bobProfile.id,
              expectedRevision: 1,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await call(
              '/v1/profile-context',
              alice.cookie,
              { profileId: mother.id, expectedRevision: 1 },
              { origin: 'https://evil.example' },
            )
          ).status,
          403,
        );
      },
    );
    await t.test(
      'context revisions reject delayed requests and concurrent switches',
      async () => {
        let callbacks = 0;
        const ref = { profileId: father.id, revision: 1 };
        assert.equal(
          await service.withActiveAccess(
            alice.actor,
            ref,
            health,
            async (p) => {
              callbacks++;
              return p.id;
            },
          ),
          father.id,
        );
        const switched = await call('/v1/profile-context', alice.cookie, {
          profileId: mother.id,
          expectedRevision: 1,
        });
        assert.equal(switched.status, 200);
        selected = await switched.json();
        await assert.rejects(
          service.withActiveAccess(alice.actor, ref, health, async () => {
            callbacks++;
          }),
          { code: 'PROFILE_CONTEXT_CHANGED' },
        );
        assert.equal(callbacks, 1);
        assert.equal(
          (
            await call('/v1/profile-context', alice.cookie, {
              profileId: father.id,
              expectedRevision: 1,
            })
          ).status,
          409,
        );
        const concurrent = await Promise.all([
          call('/v1/profile-context', alice.cookie, {
            profileId: father.id,
            expectedRevision: 2,
          }),
          call('/v1/profile-context', alice.cookie, {
            profileId: mother.id,
            expectedRevision: 2,
          }),
        ]);
        assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
        selected = await (
          await call('/v1/profile-context', alice.cookie)
        ).json();
        assert.equal(selected.revision, 3);
        const currentRef = {
          profileId: selected.profile.id,
          revision: selected.revision,
        };
        let entered, release;
        const started = new Promise((resolve) => {
          entered = resolve;
        });
        const hold = new Promise((resolve) => {
          release = resolve;
        });
        const operation = service.withActiveAccess(
          alice.actor,
          currentRef,
          health,
          async (p) => {
            entered();
            await hold;
            return p.id;
          },
        );
        await started;
        const change = service.select(alice.actor, {
          profileId: father.id,
          expectedRevision: 3,
        });
        const client = await fixture.pool.connect();
        try {
          await client.query('BEGIN');
          await assert.rejects(
            client.query(
              'SELECT session_id FROM identity_profile_context WHERE session_id=$1 FOR UPDATE NOWAIT',
              [alice.actor.sessionId],
            ),
            { code: '55P03' },
          );
          await client.query('ROLLBACK');
        } finally {
          client.release();
          release();
        }
        assert.equal(await operation, currentRef.profileId);
        selected = await change;
        assert.equal(selected.revision, 4);
        await assert.rejects(
          service.withActiveAccess(
            alice.actor,
            currentRef,
            health,
            async () => true,
          ),
          { code: 'PROFILE_CONTEXT_CHANGED' },
        );
      },
    );
    await t.test(
      'selecting a profile grants no additional scopes; revocation clears usable context without fallback',
      async () => {
        await call(`/v1/profiles/${father.id}/consents`, alice.cookie, {
          purpose: 'family_sharing',
          granted: true,
          noticeVersion: 'pilot-v1',
        });
        assert.equal(
          (
            await call(
              `/v1/profiles/${father.id}/invitations`,
              alice.cookie,
              inviteBody(),
            )
          ).status,
          201,
        );
        const capture = captures.at(-1);
        const accepted = await accept(capture.token);
        assert.equal(accepted.status, 200);
        assert.equal((await accepted.json()).profileId, father.id);
        const response = await call('/v1/profile-context', bob.cookie, {
          profileId: father.id,
          expectedRevision: 0,
        });
        assert.equal(response.status, 200);
        const current = await response.json();
        const ref = { profileId: father.id, revision: current.revision };
        assert.equal(
          await service.withActiveAccess(
            bob.actor,
            ref,
            health,
            async (p) => p.id,
          ),
          father.id,
        );
        await assert.rejects(
          service.withActiveAccess(
            bob.actor,
            ref,
            { ...health, action: 'write' },
            async () => true,
          ),
          { code: 'PROFILE_NOT_FOUND' },
        );
        await assert.rejects(
          service.withActiveAccess(
            bob.actor,
            ref,
            health,
            async () => true,
            'health_ai',
          ),
          { code: 'CONSENT_REQUIRED' },
        );
        await call(`/v1/profiles/${father.id}/consents`, alice.cookie, {
          purpose: 'family_sharing',
          granted: false,
          noticeVersion: 'pilot-v1',
        });
        await assert.rejects(
          service.withActiveAccess(bob.actor, ref, health, async () =>
            assert.fail('access before context refresh'),
          ),
          { code: 'PROFILE_NOT_FOUND' },
        );
        assert.deepEqual(
          await (await call('/v1/profile-context', bob.cookie)).json(),
          { profile: null, revision: 2 },
        );
        await assert.rejects(
          service.withActiveAccess(bob.actor, ref, health, async () =>
            assert.fail('revoked operation'),
          ),
          { code: 'PROFILE_CONTEXT_CHANGED' },
        );
        await call(`/v1/profiles/${father.id}/consents`, alice.cookie, {
          purpose: 'family_sharing',
          granted: true,
          noticeVersion: 'pilot-v1',
        });
        await call(
          `/v1/profiles/${father.id}/invitations`,
          alice.cookie,
          inviteBody(),
        );
        assert.equal((await accept(captures.at(-1).token)).status, 200);
        assert.deepEqual(
          await (await call('/v1/profile-context', bob.cookie)).json(),
          { profile: null, revision: 2 },
        );
        assert.equal(
          (await service.current(alice.actor)).profile.id,
          father.id,
        );
        assert.equal(
          (await call(`/v1/profiles/${mother.id}`, bob.cookie)).status,
          404,
        );
      },
    );
    await t.test(
      'logout removes saved context; a stale actor cannot resolve it',
      async () => {
        assert.equal(
          (await call('/api/auth/sign-out', alice.cookie, {})).status,
          200,
        );
        assert.equal(
          (await call('/v1/profile-context', alice.cookie)).status,
          401,
        );
        await assert.rejects(service.current(alice.actor), {
          code: 'UNAUTHENTICATED',
        });
        assert.equal(
          (
            await fixture.pool.query(
              'SELECT count(*) FROM identity_profile_context WHERE session_id=$1',
              [alice.actor.sessionId],
            )
          ).rows[0].count,
          '0',
        );
      },
    );
  },
);
