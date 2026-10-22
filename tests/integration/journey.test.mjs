import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import path from 'node:path';
import sharp from 'sharp';
import { postgresFixture, freePort } from '../helpers/postgres.mjs';
import { migrateDatabase } from '../../dist/infrastructure/db/migrations.js';
import { createIdentityAuth } from '../../dist/modules/identity/src/infrastructure/auth.js';
import {
  createProfileStore,
  invitationTokens,
} from '../../dist/modules/identity/src/infrastructure/profiles.js';
import { createProfileService } from '../../dist/modules/identity/src/application/profiles.js';
import { createJourneyService } from '../../dist/modules/health/src/application/journey.js';
import { createJourneyRepository } from '../../dist/modules/health/src/infrastructure/journey.js';
import {
  createReportService,
  createReportWorker,
} from '../../dist/modules/health/src/application/reports.js';
import { createReportRepository } from '../../dist/modules/health/src/infrastructure/reports.js';
import {
  createLocalPrivateFiles,
  createPrivateObjectSecurity,
} from '../../dist/infrastructure/storage/local-private.js';
import { createVerifiedAccounts } from '../../dist/infrastructure/jobs/postgres.js';
import { createApiServer } from '../../dist/infrastructure/http/server.js';
import { createStatusService } from '../../dist/apps/api/src/application/status.js';
import { createJourneyController } from '../../dist/apps/api/src/controllers/journey.js';
import { storyDate } from '../../dist/shared/contracts/src/journey.js';
import {
  createPilotBackup,
  restorePilotBackup,
} from '../../tools/pilot-backup.mjs';

test(
  'health story: encrypted context, timeline, checkpoints and permission boundaries',
  { timeout: 180000 },
  async (t) => {
    const f = await postgresFixture();
    t.after(() => f.close());
    await migrateDatabase(f.pool, path.resolve('infrastructure/db/migrations'));
    const origin = `http://127.0.0.1:${await freePort()}`,
      secret = randomBytes(48).toString('hex'),
      mail = [],
      invitations = [];
    const auth = createIdentityAuth(
      f.pool,
      { origin, secret },
      { deliver: async (m) => mail.push(m) },
    );
    const profiles = createProfileService(
      createProfileStore(f.pool),
      { deliver: async (m) => invitations.push(m) },
      invitationTokens,
    );
    const repo = createJourneyRepository(f.pool, secret),
      service = createJourneyService(profiles, repo);
    const server = createApiServer(
      createStatusService({ check: async () => {}, close: async () => {} }),
      {
        origin,
        handler: auth.handler,
        currentActor: auth.sessions.currentActor,
        health: createJourneyController(service),
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
    async function account(email) {
      const password = 'Synthetic journey password 489!';
      const call = (url, body) =>
        auth.handler(
          new globalThis.Request(origin + url, {
            method: 'POST',
            headers: { origin, 'content-type': 'application/json' },
            body: JSON.stringify(body),
          }),
        );
      assert.equal(
        (
          await call('/api/auth/sign-up/email', {
            email,
            password,
            name: 'Synthetic journey account',
          })
        ).status,
        200,
      );
      await auth.handler(
        new globalThis.Request(mail.findLast((m) => m.recipient === email).url),
      );
      const login = await call('/api/auth/sign-in/email', { email, password });
      const cookie = login.headers
          .getSetCookie()
          .map((c) => c.split(';')[0])
          .join('; '),
        actor = await auth.sessions.currentActor({ cookie });
      const profile = await profiles.create(actor, {
        displayName: 'Synthetic journey family',
        kind: 'family',
      });
      const selected = await profiles.select(actor, {
        profileId: profile.id,
        expectedRevision: 0,
      });
      return {
        actor,
        cookie,
        context: { profileId: profile.id, revision: selected.revision },
      };
    }
    const owner = await account('journey-owner@example.test'),
      other = await account('journey-other@example.test');
    const query = (who) => service.query(who.actor, { context: who.context });
    const content = (label = 'SYNTHETIC Medicine A') => ({
      information: {
        kind: 'medication',
        label,
        details: 'Reported use; not a prescription',
        strength: null,
        dose: null,
        route: null,
        schedule: null,
      },
      start: storyDate('2024-03'),
      end: storyDate(''),
      state: 'uncertain',
      source: { kind: 'reported' },
      conflictsWith: [],
    });
    const input = (who = owner) => ({
      context: who.context,
      requestKey: randomUUID(),
      recordId: randomUUID(),
      expectedRevision: 0,
      reason: 'Initial synthetic reported record',
      confirmed: true,
      content: content(),
    });
    let first, recordId;
    await t.test(
      'new profiles have no fabricated history and source-qualified records are encrypted',
      async () => {
        const empty = await query(owner);
        assert.equal(empty.firstReview, true);
        assert.equal(empty.totalEvents, 0);
        assert.equal(empty.canWrite, true);
        first = input();
        recordId = first.recordId;
        assert.equal((await service.save(owner.actor, first)).revision, 1);
        assert.equal((await service.save(owner.actor, first)).revision, 1);
        await assert.rejects(
          service.save(owner.actor, { ...first, content: content('changed') }),
          { code: 'IDEMPOTENCY_CONFLICT' },
        );
        const snapshot = await query(owner);
        assert.equal(snapshot.records[0].reporter, 'caregiver');
        assert.equal(snapshot.events[0].date.precision, 'month');
        assert.equal(snapshot.events[0].authority, 'Reported by a caregiver');
        assert.equal(snapshot.summary.observations, 0);
        const raw = (
          await f.pool.query('SELECT ciphertext FROM health_story_versions')
        ).rows[0].ciphertext;
        assert.equal(raw.includes(Buffer.from('SYNTHETIC Medicine A')), false);
        assert.equal((await query(other)).records.length, 0);
        await assert.rejects(
          service.history(other.actor, other.context, recordId),
          { code: 'STORY_RECORD_NOT_FOUND' },
        );
      },
    );
    await t.test(
      'concurrent corrections append exactly one revision and stale edits fail',
      async () => {
        const results = await Promise.allSettled(
          [1, 2].map((n) =>
            service.save(owner.actor, {
              ...first,
              requestKey: randomUUID(),
              expectedRevision: 1,
              reason: 'Correcting synthetic record ' + n,
              content: { ...content(), state: 'current' },
            }),
          ),
        );
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(
          results.find((r) => r.status === 'rejected').reason.code,
          'STORY_REVISION_CHANGED',
        );
        const history = await service.history(
          owner.actor,
          owner.context,
          recordId,
        );
        assert.deepEqual(
          history.map((r) => r.revision),
          [2, 1],
        );
        await assert.rejects(
          f.pool.query('UPDATE health_story_versions SET revision=9'),
          /append-only/i,
        );
        const foreign = input();
        foreign.content.conflictsWith = [randomUUID()];
        await assert.rejects(service.save(owner.actor, foreign), {
          code: 'CONTEXT_SOURCE_UNAVAILABLE',
        });
      },
    );
    let checkpoint;
    await t.test(
      'review checkpoints reject stale snapshots and preserve changes added afterwards',
      async () => {
        const before = await query(owner);
        checkpoint = {
          context: owner.context,
          requestKey: randomUUID(),
          snapshot: before.snapshot,
        };
        await service.review(owner.actor, checkpoint);
        const second = input();
        second.content = {
          ...content('SYNTHETIC older context'),
          start: storyDate('2020'),
        };
        await service.save(owner.actor, second);
        // Replay acknowledges the old snapshot only, not the new record.
        await service.review(owner.actor, checkpoint);
        const after = await query(owner);
        assert.equal(after.totalChanges, 1);
        assert.match(after.changes[0].detail, /historical evidence/);
        await assert.rejects(
          service.review(owner.actor, {
            ...checkpoint,
            requestKey: randomUUID(),
          }),
          { code: 'JOURNEY_CHANGED' },
        );
        await assert.rejects(
          service.query(owner.actor, {
            context: owner.context,
            expectedSnapshot: before.snapshot,
            offset: 40,
          }),
          { code: 'JOURNEY_CHANGED' },
        );
        assert.equal((await query(other)).firstReview, true);
      },
    );
    const reportRepo = createReportRepository(f.pool),
      files = createLocalPrivateFiles(
        path.join(f.directory, 'objects'),
        secret,
        20 * 1024 * 1024,
      ),
      security = createPrivateObjectSecurity(secret);
    const reports = createReportService(profiles, reportRepo, files, security);
    let report, detail, observation, verification;
    await t.test(
      'existing report evidence backfills by observation date and corrections keep stable event identity',
      async () => {
        const bytes = await sharp({
          create: { width: 600, height: 400, channels: 3, background: 'white' },
        })
          .png()
          .toBuffer();
        report = await reports.upload(
          owner.actor,
          owner.context,
          bytes,
          randomUUID(),
          'Synthetic historical report.png',
        );
        const worker = createReportWorker(
          reportRepo,
          files,
          security,
          profiles,
          createVerifiedAccounts(f.pool),
          {
            scan: async () => 'clean',
            extract: async () => [
              {
                png: bytes,
                width: 600,
                height: 400,
                lines: [
                  {
                    text: 'Patient: Synthetic journey family',
                    box: { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.2 },
                    confidence: 0.99,
                  },
                  {
                    text: 'Synthetic Marker 5.90 mg/L',
                    box: { x0: 0.1, y0: 0.3, x1: 0.9, y1: 0.4 },
                    confidence: 0.99,
                  },
                ],
              },
            ],
          },
        );
        assert.equal((await worker.runOnce()).status, 'review_needed');
        detail = await reports.detail(owner.actor, owner.context, report.id);
        report = await reports.identity(owner.actor, report.id, {
          context: owner.context,
          expectedRevision: detail.report.revision,
          state: 'matched',
          confirmedSubject: true,
          reason: 'Confirmed synthetic report identity',
        });
        verification = {
          context: owner.context,
          expectedRevision: report.revision,
          candidateId: detail.candidates[0].id,
          originalName: 'Synthetic Marker',
          value: { kind: 'quantity', comparator: '=', amount: '5.90' },
          unit: 'mg/L',
          reason: 'Confirmed synthetic source field',
          metadata: {
            observedDate: '2020-04-01',
            sourceFieldId: detail.candidates[0].rawFieldId,
          },
        };
        observation = await reports.verify(
          owner.actor,
          report.id,
          verification,
        );
        const before = await query(owner),
          event = before.events.find((e) => e.kind === 'observation');
        assert.equal(event.date.value, '2020-04-01');
        assert.equal(event.reportId, report.id);
        assert.ok(event.rawFieldId);
        await service.review(owner.actor, {
          context: owner.context,
          requestKey: randomUUID(),
          snapshot: before.snapshot,
        });
        detail = await reports.detail(owner.actor, owner.context, report.id);
        await reports.verify(owner.actor, report.id, {
          ...verification,
          expectedRevision: detail.report.revision,
          previousObservationId: observation.observationId,
          value: { kind: 'quantity', comparator: '=', amount: '5.80' },
          reason: 'Corrected transcription after inspection',
        });
        const after = await query(owner),
          corrected = after.events.find((e) => e.kind === 'observation');
        assert.equal(corrected.id, event.id);
        assert.equal(corrected.revision, 2);
        assert.equal(after.summary.observations, 1);
        assert.equal(
          after.changes.find((c) => c.id === event.id).kind,
          'updated',
        );
      },
    );
    let documentRecord;
    await t.test(
      'document-backed context requires an available source and loses trusted content on withdrawal',
      async () => {
        documentRecord = input();
        documentRecord.content = {
          ...content('SYNTHETIC documented note'),
          source: {
            kind: 'document',
            reportId: report.id,
            pageNumber: 1,
            excerpt: 'Synthetic source excerpt checked by user',
          },
        };
        await service.save(owner.actor, documentRecord);
        const bad = input();
        bad.content.source = {
          ...documentRecord.content.source,
          reportId: randomUUID(),
        };
        await assert.rejects(service.save(owner.actor, bad), {
          code: 'CONTEXT_SOURCE_UNAVAILABLE',
        });
        const d = await reports.detail(owner.actor, owner.context, report.id);
        await reports.act(
          owner.actor,
          report.id,
          { context: owner.context, expectedRevision: d.report.revision },
          'cancel',
        );
        const s = await query(owner),
          record = s.records.find((r) => r.id === documentRecord.recordId);
        assert.equal(record.content, null);
        assert.equal(record.unavailableReason, 'SOURCE_UNAVAILABLE');
        assert.equal(
          s.events.some((e) => e.kind === 'observation'),
          false,
        );
        assert.equal(
          (
            await service.history(
              owner.actor,
              owner.context,
              documentRecord.recordId,
            )
          )[0].content,
          null,
        );
      },
    );
    await t.test(
      'pagination includes an undated lane and effective filters preserve partial dates',
      async () => {
        for (let n = 0; n < 42; n++) {
          const i = input();
          i.content = {
            ...content('SYNTHETIC page ' + n),
            start: storyDate(n === 0 ? '' : '2024-03'),
          };
          await service.save(owner.actor, i);
        }
        const s = await query(owner);
        assert.equal(s.events.length, 40);
        assert.ok(s.nextOffset);
        assert.ok(s.summary.undated);
        const next = await service.query(owner.actor, {
          context: owner.context,
          offset: s.nextOffset,
          expectedSnapshot: s.snapshot,
        });
        assert.equal(next.events.at(-1).date.precision, 'unknown');
        const filtered = await service.query(owner.actor, {
          context: owner.context,
          from: '2024-03-15',
          to: '2024-03-20',
        });
        assert.ok(filtered.totalEvents > 40);
        assert.ok(filtered.events.every((e) => e.date.value === '2024-03'));
      },
    );
    await t.test(
      'read-only caregivers have independent checkpoints and cannot save context; revocation denies reads',
      async () => {
        await profiles.consent(owner.actor, owner.context.profileId, {
          purpose: 'family_sharing',
          noticeVersion: 'pilot-v1',
          granted: true,
        });
        await profiles.invite(owner.actor, owner.context.profileId, {
          email: other.actor.email,
          role: 'viewer',
          scopes: [
            { category: 'profile', action: 'read', purpose: 'care' },
            { category: 'health', action: 'read', purpose: 'care' },
          ],
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        });
        const accepted = await profiles.accept(other.actor, {
          token: invitations.at(-1).token,
        });
        const selected = await profiles.select(other.actor, {
          profileId: owner.context.profileId,
          expectedRevision: other.context.revision,
        });
        const context = {
          profileId: owner.context.profileId,
          revision: selected.revision,
        };
        const s = await service.query(other.actor, { context });
        assert.equal(s.canWrite, false);
        assert.equal(s.firstReview, true);
        await service.review(other.actor, {
          context,
          requestKey: randomUUID(),
          snapshot: s.snapshot,
        });
        await assert.rejects(
          service.save(other.actor, { ...input(), context }),
          { code: 'PROFILE_NOT_FOUND' },
        );
        await profiles.revoke(
          owner.actor,
          owner.context.profileId,
          accepted.grantId,
        );
        await assert.rejects(service.query(other.actor, { context }), {
          code: 'PROFILE_NOT_FOUND',
        });
      },
    );
    await t.test(
      'encrypted restore preserves story records, revisions, checkpoints and authorization',
      async () => {
        const restored = await postgresFixture();
        try {
          const file = path.join(f.directory, 'story.bvbackup'),
            passphrase = randomBytes(32).toString('hex');
          await createPilotBackup({
            config: f.config,
            objectsDirectory: path.join(f.directory, 'objects'),
            authSecret: secret,
            passphrase,
            destination: file,
          });
          const result = await restorePilotBackup({
            file,
            passphrase,
            config: restored.config,
            objectsDirectory: path.join(restored.directory, 'objects'),
            isolatedRoot: restored.directory,
          });
          const restoredProfiles = createProfileService(
            createProfileStore(restored.pool),
            { deliver: async () => {} },
            invitationTokens,
          );
          const restoredService = createJourneyService(
            restoredProfiles,
            createJourneyRepository(restored.pool, result.authSecret),
          );
          const before = await query(owner),
            after = await restoredService.query(owner.actor, {
              context: owner.context,
            });
          assert.equal(after.snapshot, before.snapshot);
          assert.deepEqual(after.records, before.records);
          assert.equal(after.reviewedAt, before.reviewedAt);
          assert.deepEqual(
            await restoredService.history(owner.actor, owner.context, recordId),
            await service.history(owner.actor, owner.context, recordId),
          );
          await assert.rejects(
            restoredService.query(other.actor, { context: owner.context }),
          );
          await assert.rejects(
            createJourneyRepository(
              restored.pool,
              randomBytes(48).toString('hex'),
            ).read(owner.context.profileId, owner.actor.id, true),
          );
        } finally {
          await restored.close();
        }
      },
    );
    await t.test(
      'HTTP rejects forged origins, invalid authority and stale profile contexts',
      async () => {
        const headers = {
          origin,
          cookie: owner.cookie,
          'content-type': 'application/json',
          'x-profile-id': owner.context.profileId,
          'x-context-revision': String(owner.context.revision),
        };
        assert.equal(
          (await fetch(origin + '/v1/health/journey', { headers })).status,
          200,
        );
        assert.equal(
          (
            await fetch(origin + '/v1/health/journey/records', {
              method: 'POST',
              headers: { ...headers, origin: 'https://forged.invalid' },
              body: JSON.stringify(input()),
            })
          ).status,
          403,
        );
        const invalid = input();
        invalid.content.source = { kind: 'clinician_confirmed' };
        assert.equal(
          (
            await fetch(origin + '/v1/health/journey/records', {
              method: 'POST',
              headers,
              body: JSON.stringify(invalid),
            })
          ).status,
          400,
        );
        const sibling = await profiles.create(owner.actor, {
          displayName: 'Synthetic second family',
          kind: 'family',
        });
        await profiles.select(owner.actor, {
          profileId: sibling.id,
          expectedRevision: owner.context.revision,
        });
        assert.equal(
          (await fetch(origin + '/v1/health/journey', { headers })).status,
          409,
        );
      },
    );
    await t.test(
      'RLS protects both story tables without a profile binding',
      async () => {
        const c = await f.pool.connect();
        try {
          await c.query('CREATE ROLE story_fixture_reader NOLOGIN');
          await c.query(
            'GRANT SELECT ON health_story_versions,health_story_reviews TO story_fixture_reader',
          );
          await c.query('BEGIN');
          await c.query('SET LOCAL ROLE story_fixture_reader');
          assert.equal(
            (await c.query('SELECT count(*) FROM health_story_versions'))
              .rows[0].count,
            '0',
          );
          await c.query("SELECT set_config('biovitai.profile_id',$1,true)", [
            other.context.profileId,
          ]);
          assert.equal(
            (await c.query('SELECT count(*) FROM health_story_versions'))
              .rows[0].count,
            '0',
          );
          await c.query('ROLLBACK');
        } finally {
          await c.query('ROLLBACK');
          c.release();
        }
      },
    );
  },
);
