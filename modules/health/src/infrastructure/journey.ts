import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { databaseTransaction } from '../../../../infrastructure/db/transaction.js';
import { createEncryptedJson } from '../../../../infrastructure/storage/encrypted-json.js';
import {
  StoryContentSchema,
  StoryRecordSchema,
  storyDate,
} from '../../../../shared/contracts/src/journey.js';
import type { JourneyEvent } from '../../../../shared/contracts/src/journey.js';
import { JourneyError } from '../contracts/journey.js';
import type { JourneyRepository, StoryManifest } from '../contracts/journey.js';

const Payload = z
  .object({
    content: StoryContentSchema,
    reason: z.string(),
    reporter: z.enum(['self', 'caregiver']),
  })
  .strict();
const Manifest = z.record(z.string(), z.string());
type VersionRow = {
  id: string;
  recordId: string;
  revision: number;
  actorId: string;
  recordedAt: string;
  ciphertext: Buffer;
};
const columns =
  'id,record_id AS "recordId",revision,actor_id AS "actorId",recorded_at::text AS "recordedAt",ciphertext';
const LIMIT = 10000;
export function createJourneyRepository(
  pool: Pool,
  secret: string,
): JourneyRepository {
  const crypto = createEncryptedJson(secret, 'health-story.v1');
  const tx = <T>(profile: string, work: (c: PoolClient) => Promise<T>) =>
    databaseTransaction(pool, work, profile);
  async function decode(
    c: PoolClient,
    profile: string,
    actor: string,
    rows: VersionRow[],
  ) {
    const decoded = rows.map((row) => ({
      row,
      value: Payload.parse(crypto.decrypt(profile, row.id, row.ciphertext)),
    }));
    const sources = decoded.flatMap(({ value }) =>
      value.content.source.kind === 'document'
        ? [value.content.source.reportId]
        : [],
    );
    const pages = sources.length
      ? (
          await c.query(
            `SELECT h.id,p.page_number FROM health_ingestions h JOIN health_page_previews p ON p.profile_id=h.profile_id AND p.ingestion_id=h.id
       WHERE h.profile_id=$1 AND h.state='verified' AND h.scan_state='clean' AND h.id=ANY($2::uuid[])`,
            [profile, sources],
          )
        ).rows
      : [];
    return decoded.map(({ row, value }) => {
      const source = value.content.source;
      const available =
        source.kind !== 'document' ||
        pages.some(
          (p) =>
            p.id === source.reportId && p.page_number === source.pageNumber,
        );
      return StoryRecordSchema.parse({
        id: row.recordId,
        versionId: row.id,
        revision: row.revision,
        recordedAt: new Date(row.recordedAt).toISOString(),
        reporter: value.reporter,
        enteredByYou: row.actorId === actor,
        reason: available ? value.reason : null,
        content: available ? value.content : null,
        unavailableReason: available ? null : 'SOURCE_UNAVAILABLE',
      });
    });
  }
  return {
    hash: crypto.hash,
    read: (profile, actor, owner) =>
      tx(profile, async (c) => {
        const rows = (
          await c.query<VersionRow>(
            `SELECT DISTINCT ON(record_id) ${columns} FROM health_story_versions WHERE profile_id=$1 ORDER BY record_id,revision DESC LIMIT 501`,
            [profile],
          )
        ).rows;
        if (rows.length > 500)
          throw new JourneyError('STORY_RECORD_LIMIT', 503);
        const records = await decode(c, profile, actor, rows);
        const reports = (
          await c.query(
            `SELECT id,file_name AS "fileName",state,revision,created_at::text AS "createdAt",updated_at::text AS "updatedAt"
        FROM health_ingestions WHERE profile_id=$1 AND ($3::boolean OR actor_id=$2 OR state='verified') ORDER BY id LIMIT 10001`,
            [profile, actor, owner],
          )
        ).rows;
        const observations = (
          await c.query(
            `WITH RECURSIVE lineage AS (
          SELECT id,id AS root FROM health_source_observations WHERE profile_id=$1 AND previous_observation_id IS NULL
          UNION ALL SELECT s.id,l.root FROM health_source_observations s JOIN lineage l ON s.previous_observation_id=l.id WHERE s.profile_id=$1
        ) SELECT s.id,l.root,s.original_name AS name,s.original_value AS value,s.original_unit AS unit,s.revision,
         s.report_id AS "reportId",p.page_number AS "pageNumber",s.value_field_id AS "rawFieldId",
         COALESCE(m.observed_date,s.observed_date)::text AS date,s.verification_recorded_at::text AS "recordedAt"
        FROM health_effective_source_observations s JOIN lineage l ON l.id=s.id
        JOIN health_ingestions h ON h.profile_id=s.profile_id AND h.id=s.report_id
        JOIN health_raw_fields f ON f.profile_id=s.profile_id AND f.id=s.value_field_id
        JOIN health_report_pages p ON p.profile_id=f.profile_id AND p.id=f.page_id
        LEFT JOIN health_verified_context m ON m.profile_id=s.profile_id AND m.observation_id=s.id
        WHERE s.profile_id=$1 AND s.verification_state='verified' AND h.state<>'cancelled'
         AND ($3::boolean OR h.actor_id=$2 OR h.state='verified') ORDER BY l.root LIMIT 10001`,
            [profile, actor, owner],
          )
        ).rows;
        if (
          reports.length > LIMIT ||
          observations.length + records.length > LIMIT
        )
          throw new JourneyError('JOURNEY_SNAPSHOT_LIMIT', 503);
        const events: JourneyEvent[] = observations.map((o) => ({
          id: 'observation:' + o.root,
          kind: 'observation',
          title: o.name,
          detail: [o.value, o.unit].filter(Boolean).join(' '),
          date: storyDate(o.date ?? ''),
          endDate: null,
          recordedAt: new Date(o.recordedAt).toISOString(),
          revision: o.revision,
          authority: 'Confirmed against report source',
          reportId: o.reportId,
          pageNumber: o.pageNumber,
          rawFieldId: o.rawFieldId,
          recordId: null,
          status: 'verified',
        }));
        for (const r of records) {
          if (!r.content || r.content.state === 'entered_in_error') continue;
          const v = r.content;
          events.push({
            id: 'context:' + r.id,
            kind: 'context',
            title: v.information.label,
            detail: v.information.details,
            date: v.start,
            endDate: v.end.value ? v.end : null,
            recordedAt: r.recordedAt,
            revision: r.revision,
            authority:
              v.source.kind === 'document'
                ? 'User-confirmed document transcription'
                : r.reporter === 'self'
                  ? 'Reported by the person'
                  : 'Reported by a caregiver',
            reportId: v.source.kind === 'document' ? v.source.reportId : null,
            pageNumber:
              v.source.kind === 'document' ? v.source.pageNumber : null,
            rawFieldId: null,
            recordId: r.id,
            status: v.state,
          });
        }
        return { records, events, reports };
      }),
    save: (actor, reporter, input) =>
      tx(input.context.profileId, async (c) => {
        const profile = input.context.profileId;
        const fingerprint = crypto.hash({ actor, input });
        const prior = (
          await c.query(
            'SELECT record_id,revision,fingerprint FROM health_story_versions WHERE profile_id=$1 AND request_key=$2',
            [profile, input.requestKey],
          )
        ).rows[0];
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new JourneyError('IDEMPOTENCY_CONFLICT');
          return { recordId: prior.record_id, revision: prior.revision };
        }
        const old = (
          await c.query<VersionRow>(
            `SELECT ${columns} FROM health_story_versions WHERE profile_id=$1 AND record_id=$2 ORDER BY revision DESC LIMIT 1`,
            [profile, input.recordId],
          )
        ).rows[0];
        if ((old?.revision ?? 0) !== input.expectedRevision)
          throw new JourneyError('STORY_REVISION_CHANGED');
        if (
          old &&
          Payload.parse(crypto.decrypt(profile, old.id, old.ciphertext)).content
            .information.kind !== input.content.information.kind
        )
          throw new JourneyError('STORY_KIND_IMMUTABLE');
        if (input.content.conflictsWith.includes(input.recordId))
          throw new JourneyError('INVALID_CONFLICT_LINK', 400);
        if (input.content.conflictsWith.length) {
          const found = await c.query(
            'SELECT count(DISTINCT record_id)::int AS count FROM health_story_versions WHERE profile_id=$1 AND record_id=ANY($2::uuid[])',
            [profile, input.content.conflictsWith],
          );
          if (found.rows[0].count !== input.content.conflictsWith.length)
            throw new JourneyError('CONTEXT_SOURCE_UNAVAILABLE', 404);
        }
        const source = input.content.source;
        if (source.kind === 'document') {
          const found = await c.query(
            `SELECT 1 FROM health_ingestions h JOIN health_page_previews p ON p.profile_id=h.profile_id AND p.ingestion_id=h.id
          WHERE h.profile_id=$1 AND h.id=$2 AND h.state='verified' AND h.scan_state='clean' AND p.page_number=$3`,
            [profile, source.reportId, source.pageNumber],
          );
          if (!found.rowCount)
            throw new JourneyError('CONTEXT_SOURCE_UNAVAILABLE', 404);
        }
        if (
          !old &&
          (
            await c.query(
              'SELECT count(DISTINCT record_id)::int AS count FROM health_story_versions WHERE profile_id=$1',
              [profile],
            )
          ).rows[0].count >= 500
        )
          throw new JourneyError('STORY_RECORD_LIMIT', 409);
        const id = randomUUID(),
          revision = (old?.revision ?? 0) + 1;
        await c.query(
          `INSERT INTO health_story_versions(id,profile_id,record_id,revision,previous_version_id,actor_id,request_key,fingerprint,ciphertext)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            id,
            profile,
            input.recordId,
            revision,
            old?.id ?? null,
            actor,
            input.requestKey,
            fingerprint,
            crypto.encrypt(profile, id, {
              content: input.content,
              reason: input.reason,
              reporter,
            }),
          ],
        );
        return { recordId: input.recordId, revision };
      }),
    history: (profile, actor, record) =>
      tx(profile, async (c) => {
        const rows = (
          await c.query<VersionRow>(
            `SELECT ${columns} FROM health_story_versions WHERE profile_id=$1 AND record_id=$2 ORDER BY revision DESC LIMIT 1001`,
            [profile, record],
          )
        ).rows;
        if (!rows.length) throw new JourneyError('STORY_RECORD_NOT_FOUND', 404);
        if (rows.length > 1000)
          throw new JourneyError('STORY_HISTORY_LIMIT', 503);
        return decode(c, profile, actor, rows);
      }),
    checkpoint: (profile, actor) =>
      tx(profile, async (c) => {
        const row = (
          await c.query(
            'SELECT request_key,snapshot,ciphertext,recorded_at::text AS "reviewedAt" FROM health_story_reviews WHERE profile_id=$1 AND actor_id=$2 ORDER BY sequence DESC LIMIT 1',
            [profile, actor],
          )
        ).rows[0];
        return row
          ? {
              reviewedAt: row.reviewedAt,
              manifest: Manifest.parse(
                crypto.decrypt(
                  profile,
                  `review:${actor}:${row.request_key}`,
                  row.ciphertext,
                ),
              ),
            }
          : null;
      }),
    review: (actor, input, manifest: StoryManifest) =>
      tx(input.context.profileId, async (c) => {
        const profile = input.context.profileId;
        const prior = (
          await c.query(
            'SELECT snapshot FROM health_story_reviews WHERE profile_id=$1 AND actor_id=$2 AND request_key=$3',
            [profile, actor, input.requestKey],
          )
        ).rows[0];
        if (prior) {
          if (prior.snapshot !== input.snapshot)
            throw new JourneyError('IDEMPOTENCY_CONFLICT');
          return;
        }
        if (crypto.hash(manifest) !== input.snapshot)
          throw new JourneyError('JOURNEY_CHANGED');
        await c.query(
          'INSERT INTO health_story_reviews(profile_id,actor_id,request_key,snapshot,ciphertext) VALUES($1,$2,$3,$4,$5)',
          [
            profile,
            actor,
            input.requestKey,
            input.snapshot,
            crypto.encrypt(
              profile,
              `review:${actor}:${input.requestKey}`,
              manifest,
            ),
          ],
        );
      }),
    ready: async () => {
      await pool.query('SELECT id FROM health_story_versions LIMIT 0');
    },
  };
}
