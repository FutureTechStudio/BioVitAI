import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { TextEncoder } from 'node:util';
import { once } from 'node:events';
import { randomUUID, randomBytes } from 'node:crypto';
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
import {
  createReportService,
  createReportWorker,
} from '../../dist/modules/health/src/application/reports.js';
import { createReportRepository } from '../../dist/modules/health/src/infrastructure/reports.js';
import {
  createLocalPrivateFiles,
  createPrivateObjectSecurity,
} from '../../dist/infrastructure/storage/local-private.js';
import { createApiServer } from '../../dist/infrastructure/http/server.js';
import { createStatusService } from '../../dist/apps/api/src/application/status.js';
import { createReportController } from '../../dist/apps/api/src/controllers/reports.js';
import { createProfileController } from '../../dist/apps/api/src/controllers/profiles.js';
import { createVerifiedAccounts } from '../../dist/infrastructure/jobs/postgres.js';
import { ReportError } from '../../dist/modules/health/src/contracts/ingestion.js';
import {
  createPilotBackup,
  restorePilotBackup,
  readPilotBackup,
} from '../../tools/pilot-backup.mjs';
import {
  createBudgetLedger,
  createConversationStore,
} from '../../dist/infrastructure/ai-gateway/postgres.js';
import { createConversationService } from '../../dist/modules/ai/src/application/conversations.js';

test(
  'report ingestion, quarantine and immutable verification on PostgreSQL and HTTP',
  { timeout: 180000 },
  async (t) => {
    const fixture = await postgresFixture();
    t.after(() => fixture.close());
    await migrateDatabase(
      fixture.pool,
      path.resolve('infrastructure/db/migrations'),
    );
    const origin = `http://127.0.0.1:${await freePort()}`,
      messages = [];
    const appSecret = randomBytes(48).toString('hex');
    const auth = createIdentityAuth(
      fixture.pool,
      { origin, secret: appSecret },
      { deliver: async (message) => messages.push(message) },
    );
    const profiles = createProfileService(
      createProfileStore(fixture.pool),
      { deliver: async () => {} },
      invitationTokens,
    );
    const repo = createReportRepository(fixture.pool),
      security = createPrivateObjectSecurity(randomBytes(48).toString('hex'));
    const files = createLocalPrivateFiles(
      path.join(fixture.directory, 'objects'),
      appSecret,
      20 * 1024 * 1024,
    );
    const service = createReportService(profiles, repo, files, security);
    const server = createApiServer(
      createStatusService({ check: async () => {}, close: async () => {} }),
      {
        origin,
        handler: auth.handler,
        currentActor: auth.sessions.currentActor,
        profiles: createProfileController(profiles),
        health: createReportController(service),
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
    const call = (route, cookie, body) =>
      fetch(origin + route, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          origin,
          ...(cookie ? { cookie } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    async function account(email) {
      const password = 'Synthetic report test password 381!';
      assert.equal(
        (
          await call('/api/auth/sign-up/email', null, {
            email,
            password,
            name: 'Synthetic person',
          })
        ).status,
        200,
      );
      await fetch(messages.findLast((m) => m.recipient === email).url, {
        redirect: 'manual',
      });
      const login = await call('/api/auth/sign-in/email', null, {
        email,
        password,
      });
      const cookie = login.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ');
      const actor = await auth.sessions.currentActor({ cookie });
      const profile = await profiles.create(actor, {
        displayName: 'Synthetic Subject',
        kind: 'family',
      });
      const selected = await profiles.select(actor, {
        profileId: profile.id,
        expectedRevision: 0,
      });
      return {
        cookie,
        actor,
        context: { profileId: profile.id, revision: selected.revision },
      };
    }
    const owner = await account('report-owner@example.test'),
      other = await account('report-other@example.test');
    const bytes = await sharp({
      create: { width: 600, height: 400, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    const upload = (who, data = bytes, key = randomUUID()) =>
      fetch(origin + '/v1/health/reports/upload', {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/octet-stream',
          cookie: who.cookie,
          'x-profile-id': who.context.profileId,
          'x-context-revision': String(who.context.revision),
          'idempotency-key': key,
          'x-file-name': 'synthetic.png',
        },
        body: data,
      });
    const query = (who) =>
      `?profileId=${who.context.profileId}&revision=${who.context.revision}`;
    let report, detail;
    await t.test(
      'binary upload is bounded, authorized, idempotent and profile-scoped',
      async () => {
        const key = randomUUID(),
          response = await upload(owner, bytes, key);
        assert.equal(response.status, 201);
        report = (await response.json()).report;
        assert.equal(report.state, 'queued');
        assert.equal((await upload(owner, bytes, key)).status, 201);
        const second = (await (await upload(owner)).json()).report;
        assert.equal(second.id, report.id);
        const changed = await sharp(bytes).negate().png().toBuffer();
        assert.equal((await upload(owner, changed, key)).status, 409);
        assert.equal(
          (await upload({ ...other, context: owner.context })).status,
          409,
        );
        assert.equal(
          (await upload(owner, new TextEncoder().encode('fake-pdf'))).status,
          415,
        );
        assert.equal(
          (
            await fetch(
              origin +
                `/v1/health/reports/${report.id}/original` +
                query(owner),
              { headers: { cookie: owner.cookie } },
            )
          ).status,
          423,
        );
        assert.equal(
          (
            await fixture.pool.query(
              'SELECT count(*) FROM health_source_documents',
            )
          ).rows[0].count,
          '0',
        );
      },
    );
    const line = (text, y) => ({
      text,
      box: { x0: 0.1, y0: y, x1: 0.9, y1: y + 0.05 },
      confidence: 0.95,
    });
    let scan = 'clean',
      mixed = false,
      unavailable = false;
    const processor = {
      scan: async () => {
        if (unavailable) throw new ReportError('SCANNER_UNAVAILABLE', 503);
        return scan;
      },
      extract: async () => [
        {
          png: bytes,
          width: 600,
          height: 400,
          lines: [
            line('Patient: Synthetic Subject', 0.1),
            ...(mixed ? [line('Patient: Different Person', 0.2)] : []),
            line('Synthetic Marker <5.90 mg/L 0 - 10', 0.3),
          ],
        },
      ],
    };
    const worker = createReportWorker(
      repo,
      files,
      security,
      profiles,
      createVerifiedAccounts(fixture.pool),
      processor,
    );
    await t.test(
      'fenced worker creates source-linked candidates but requires explicit identity review',
      async () => {
        assert.equal((await worker.runOnce()).status, 'review_needed');
        detail = await service.detail(owner.actor, owner.context, report.id);
        report = detail.report;
        assert.equal(detail.identity.state, 'pending');
        assert.equal(detail.candidates.length, 1);
        assert.equal(detail.candidates[0].parsed.value.comparator, '<');
        assert.equal(detail.candidates[0].parsed.value.amount, '5.90');
        assert.deepEqual(
          await service.observations(owner.actor, owner.context),
          [],
        );
        assert.equal(
          (await service.preview(owner.actor, owner.context, report.id, 1))
            .length,
          bytes.length,
        );
        await assert.rejects(
          service.detail(other.actor, other.context, report.id),
          { code: 'REPORT_NOT_FOUND' },
        );
      },
    );
    const verification = () => ({
      context: owner.context,
      expectedRevision: report.revision,
      candidateId: detail.candidates[0].id,
      originalName: 'Synthetic Marker',
      value: { kind: 'quantity', comparator: '<', amount: '5.90' },
      unit: 'mg/L',
      referenceText: '0 - 10',
      reason: 'Checked against synthetic source page',
      previousObservationId: null,
    });
    await t.test(
      'identity confirmation precedes verification; corrections append and supersede sources',
      async () => {
        await assert.rejects(
          service.verify(owner.actor, report.id, verification()),
          { code: 'IDENTITY_CONFIRMATION_REQUIRED' },
        );
        report = await service.identity(owner.actor, report.id, {
          context: owner.context,
          expectedRevision: report.revision,
          confirmedSubject: true,
          state: 'matched',
          reason: 'Confirmed synthetic subject against source',
        });
        const first = await service.verify(owner.actor, report.id, {
          ...verification(),
          metadata: {
            observedDate: '2026-10-21',
            sourceFieldId: detail.candidates[0].rawFieldId,
          },
        });
        detail = await service.detail(owner.actor, owner.context, report.id);
        report = detail.report;
        assert.equal(report.state, 'verified');
        assert.equal(detail.observations[0].verificationState, 'verified');
        assert.equal(detail.observations[0].referenceText, '0 - 10');
        assert.equal(
          detail.observations[0].referenceFieldId,
          detail.candidates[0].rawFieldId,
        );
        assert.equal(
          detail.observations[0].metadata.observedDate,
          '2026-10-21',
        );
        assert.equal(detail.observations[0].metadata.method, null);
        assert.equal(
          (await service.observations(owner.actor, owner.context))[0].date,
          '2026-10-21',
        );
        const corrected = await service.verify(owner.actor, report.id, {
          ...verification(),
          previousObservationId: first.observationId,
          value: { kind: 'quantity', comparator: '<', amount: '5.80' },
          reason: 'Corrected synthetic transcription after source inspection',
        });
        assert.equal(corrected.revision, 2);
        const observations = (
          await service.detail(owner.actor, owner.context, report.id)
        ).observations;
        assert.equal(observations.length, 2);
        assert.equal(observations[0].verificationState, 'superseded');
        assert.equal(
          (await service.observations(owner.actor, owner.context))[0].amount,
          '5.80',
        );
        await assert.rejects(
          service.verify(owner.actor, report.id, verification()),
          { code: 'REPORT_REVISION_CHANGED' },
        );
      },
    );
    await t.test(
      'mixed identity is quarantined and cannot be cleared by a simple confirmation',
      async () => {
        mixed = true;
        const image = await sharp(bytes).resize(601, 400).png().toBuffer();
        const item = (await (await upload(owner, image)).json()).report;
        await worker.runOnce();
        const state = await service.detail(owner.actor, owner.context, item.id);
        assert.equal(state.report.state, 'quarantined');
        await assert.rejects(
          service.identity(owner.actor, item.id, {
            context: owner.context,
            expectedRevision: state.report.revision,
            confirmedSubject: true,
            state: 'matched',
            reason: 'Attempted override of conflicting names',
          }),
          { code: 'MIXED_IDENTITY_REQUIRES_REUPLOAD' },
        );
        mixed = false;
      },
    );
    await t.test(
      'scanner outage is visible and retry/cancel actions are revision-controlled',
      async () => {
        unavailable = true;
        const image = await sharp(bytes).resize(602, 400).png().toBuffer();
        const item = (await (await upload(owner, image)).json()).report;
        assert.equal((await worker.runOnce()).code, 'SCANNER_UNAVAILABLE');
        let state = (await service.detail(owner.actor, owner.context, item.id))
          .report;
        assert.equal(state.state, 'failed');
        assert.equal(state.scanState, 'unavailable');
        state = await service.act(
          owner.actor,
          item.id,
          { context: owner.context, expectedRevision: state.revision },
          'retry',
        );
        assert.equal(state.state, 'queued');
        state = await service.act(
          owner.actor,
          item.id,
          { context: owner.context, expectedRevision: state.revision },
          'cancel',
        );
        assert.equal(state.state, 'cancelled');
        unavailable = false;
      },
    );
    await t.test(
      'malware detection prevents extraction, source creation and original downloads',
      async () => {
        scan = 'infected';
        const image = await sharp(bytes).resize(603, 400).png().toBuffer();
        const item = (await (await upload(owner, image)).json()).report;
        assert.equal((await worker.runOnce()).code, 'MALWARE_DETECTED');
        const state = (
          await service.detail(owner.actor, owner.context, item.id)
        ).report;
        assert.equal(state.scanState, 'infected');
        await assert.rejects(
          service.original(owner.actor, owner.context, item.id),
          { code: 'ORIGINAL_UNAVAILABLE' },
        );
        await assert.rejects(
          service.act(
            owner.actor,
            item.id,
            { context: owner.context, expectedRevision: state.revision },
            'retry',
          ),
          { code: 'REPORT_NOT_RETRYABLE' },
        );
      },
    );
    await t.test(
      'manual source selection and declared report relationships preserve separate evidence',
      async () => {
        mixed = false;
        scan = 'clean';
        unavailable = false;
        const image = await sharp(bytes).resize(609, 400).png().toBuffer();
        const item = (await (await upload(owner, image)).json()).report;
        await worker.runOnce();
        let next = await service.detail(owner.actor, owner.context, item.id);
        await service.identity(owner.actor, item.id, {
          context: owner.context,
          expectedRevision: next.report.revision,
          confirmedSubject: true,
          state: 'matched',
          reason: 'Confirmed synthetic comparison source',
        });
        next = await service.detail(owner.actor, owner.context, item.id);
        await service.verify(owner.actor, item.id, {
          ...verification(),
          expectedRevision: next.report.revision,
          candidateId: next.candidates[0].id,
        });
        next = await service.detail(owner.actor, owner.context, item.id);
        detail = await service.detail(owner.actor, owner.context, report.id);
        report = detail.report;
        const relation = {
          context: owner.context,
          expectedRevision: report.revision,
          relatedReportId: item.id,
          relatedRevision: next.report.revision,
          requestKey: randomUUID(),
          kind: 'rerun',
          reason: 'Explicit synthetic rerun declaration',
        };
        await service.relate(owner.actor, report.id, relation);
        await service.relate(owner.actor, report.id, relation);
        detail = await service.detail(owner.actor, owner.context, report.id);
        report = detail.report;
        assert.equal(detail.relationships.length, 1);
        assert.equal(
          (await service.observations(owner.actor, owner.context)).length,
          2,
        );
        const manual = await service.manualCandidate(owner.actor, report.id, {
          context: owner.context,
          expectedRevision: report.revision,
          rawFieldId: detail.rawFields[0].id,
          requestKey: randomUUID(),
          reason: 'Manual synthetic result region selection',
        });
        detail = await service.detail(owner.actor, owner.context, report.id);
        report = detail.report;
        assert.ok(detail.candidates.some((c) => c.id === manual.candidateId));
        await service.verify(owner.actor, report.id, {
          ...verification(),
          candidateId: manual.candidateId,
          originalName: 'Synthetic manual review',
          value: { kind: 'missing', reason: 'Not performed' },
          unit: null,
        });
        detail = await service.detail(owner.actor, owner.context, report.id);
        report = detail.report;
      },
    );
    await t.test(
      'atomic app-wide budget cannot overspend under concurrent reservations',
      async () => {
        const ledger = createBudgetLedger(fixture.pool),
          attempts = await Promise.all(
            Array.from({ length: 20 }, () => ledger.reserve(400000)),
          );
        assert.equal(attempts.filter(Boolean).length, 12);
        assert.equal(await ledger.reserve(300000), null);
        await ledger.settle(attempts.find(Boolean), 100000);
        assert.ok(await ledger.reserve(500000));
        assert.equal(await ledger.reserve(1), null);
        const row = (
          await fixture.pool.query(
            'SELECT committed_microusd::text AS cost,day::text FROM ai_daily_budget',
          )
        ).rows[0];
        assert.equal(row.cost, '5000000');
        assert.equal(
          row.day,
          (
            await fixture.pool.query(
              "SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS day",
            )
          ).rows[0].day,
        );
      },
    );
    await t.test(
      'AI consent, citations, encrypted persistence, stale evidence and revocation are enforced',
      async () => {
        const store = createConversationStore(fixture.pool, appSecret);
        let dispatches = 0,
          hook = async () => {},
          invalid = false;
        const gateway = {
          generate: async (input) => {
            dispatches++;
            assert.equal(JSON.stringify(input).includes('Patient:'), false);
            await hook();
            return {
              status: 'ok',
              answer: {
                cards: [
                  {
                    kind: 'summary',
                    text: 'The supplied source contains a verified result.',
                    citations: [
                      {
                        observationId: invalid
                          ? randomUUID()
                          : input.evidence[0].id,
                        revision: input.evidence[0].revision,
                      },
                    ],
                  },
                ],
              },
            };
          },
        };
        const chat = createConversationService(
            profiles,
            store,
            gateway,
            service,
          ),
          input = () => ({
            context: owner.context,
            conversationId: randomUUID(),
            requestKey: randomUUID(),
            question: 'Explain only verified synthetic evidence',
          });
        await assert.rejects(chat.send(owner.actor, input()), {
          code: 'CONSENT_REQUIRED',
        });
        assert.equal(dispatches, 0);
        await profiles.consent(owner.actor, owner.context.profileId, {
          purpose: 'health_ai',
          noticeVersion: 'pilot-v1',
          granted: true,
        });
        const request = input(),
          answer = await chat.send(owner.actor, request);
        assert.ok(answer.answer);
        assert.ok((await chat.send(owner.actor, request)).answer);
        assert.equal(dispatches, 1);
        assert.equal(
          (
            await fixture.pool.query('SELECT ciphertext FROM ai_messages')
          ).rows[0].ciphertext.includes(Buffer.from(request.question)),
          false,
        );
        await profiles.consent(other.actor, other.context.profileId, {
          purpose: 'health_ai',
          noticeVersion: 'pilot-v1',
          granted: true,
        });
        assert.deepEqual(
          await chat.messages(
            other.actor,
            other.context,
            request.conversationId,
          ),
          [],
        );
        invalid = true;
        assert.equal(
          (await chat.send(owner.actor, input())).code,
          'INVALID_OUTPUT',
        );
        invalid = false;
        await fixture.pool.query(
          'UPDATE identity_user SET "emailVerified"=false WHERE id=$1',
          [owner.actor.id],
        );
        try {
          await assert.rejects(
            chat.messages(owner.actor, owner.context, request.conversationId),
            { code: 'UNAUTHENTICATED' },
          );
        } finally {
          await fixture.pool.query(
            'UPDATE identity_user SET "emailVerified"=true WHERE id=$1',
            [owner.actor.id],
          );
        }
        hook = async () => {
          const latest = await service.detail(
            owner.actor,
            owner.context,
            report.id,
          );
          await service.identity(owner.actor, report.id, {
            context: owner.context,
            expectedRevision: latest.report.revision,
            confirmedSubject: true,
            state: 'quarantined',
            reason: 'Synthetic stale evidence test',
          });
        };
        assert.equal(
          (await chat.send(owner.actor, input())).code,
          'EVIDENCE_CHANGED',
        );
        assert.equal(
          (
            await chat.messages(
              owner.actor,
              owner.context,
              request.conversationId,
            )
          )[0].code,
          'EVIDENCE_CHANGED',
        );
        const latest = await service.detail(
          owner.actor,
          owner.context,
          report.id,
        );
        await service.identity(owner.actor, report.id, {
          context: owner.context,
          expectedRevision: latest.report.revision,
          confirmedSubject: true,
          state: 'matched',
          reason: 'Synthetic identity recheck',
        });
        detail = await service.detail(owner.actor, owner.context, report.id);
        report = detail.report;
        await service.verify(owner.actor, report.id, {
          ...verification(),
          previousObservationId: detail.candidates[0].observationId,
        });
        hook = async () => {
          await profiles.consent(owner.actor, owner.context.profileId, {
            purpose: 'health_ai',
            noticeVersion: 'pilot-v1',
            granted: false,
          });
        };
        await assert.rejects(chat.send(owner.actor, input()), {
          code: 'CONSENT_REQUIRED',
        });
      },
    );
    await t.test(
      'encrypted backup restores original evidence, sessions, permissions and keys into an isolated cluster',
      async () => {
        const restored = await postgresFixture();
        try {
          const file = path.join(fixture.directory, 'pilot.bvbackup'),
            passphrase = randomBytes(32).toString('hex');
          const backup = await createPilotBackup({
            config: fixture.config,
            objectsDirectory: path.join(fixture.directory, 'objects'),
            authSecret: appSecret,
            passphrase,
            destination: file,
          });
          assert.ok(backup.objects > 0);
          await assert.rejects(
            readPilotBackup(
              file,
              'incorrect backup password which is long enough',
            ),
          );
          const result = await restorePilotBackup({
            file,
            passphrase,
            config: restored.config,
            objectsDirectory: path.join(restored.directory, 'objects'),
            isolatedRoot: restored.directory,
          });
          assert.equal(result.authSecret, appSecret);
          const restoredAuth = createIdentityAuth(
            restored.pool,
            { origin, secret: result.authSecret },
            { deliver: async () => {} },
          );
          assert.equal(
            (await restoredAuth.sessions.currentActor({ cookie: owner.cookie }))
              .id,
            owner.actor.id,
          );
          const restoredProfiles = createProfileService(
              createProfileStore(restored.pool),
              { deliver: async () => {} },
              invitationTokens,
            ),
            restoredFiles = createLocalPrivateFiles(
              path.join(restored.directory, 'objects'),
              result.authSecret,
              20 * 1024 * 1024,
            ),
            restoredReports = createReportService(
              restoredProfiles,
              createReportRepository(restored.pool),
              restoredFiles,
              security,
            );
          assert.deepEqual(
            await restoredReports.observations(owner.actor, owner.context),
            await service.observations(owner.actor, owner.context),
          );
          assert.equal(
            (
              await restoredReports.original(
                owner.actor,
                owner.context,
                report.id,
              )
            ).bytes.length,
            bytes.length,
          );
          await assert.rejects(
            restoredReports.detail(other.actor, other.context, report.id),
            { code: 'REPORT_NOT_FOUND' },
          );
        } finally {
          await restored.close();
        }
      },
    );
  },
);
