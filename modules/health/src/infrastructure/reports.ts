import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  telemetry,
  traceId,
} from '../../../../infrastructure/observability/tracing.js';
import { databaseTransaction } from '../../../../infrastructure/db/transaction.js';
import {
  IngestionSchema,
  IdentityReviewSchema,
  VerificationInputSchema,
  ReportRelationshipSchema,
  ManualCandidateSchema,
} from '../../../../shared/contracts/src/reports.js';
import { ReportError } from '../contracts/ingestion.js';
import type { ReportRepository, ReportRecord } from '../contracts/ingestion.js';
import { parseReportLine } from '../domain/extraction.js';

const columns = `id,file_name AS "fileName",media_type AS "mediaType",byte_length AS "byteLength",state,stage,scan_state AS "scanState",revision,attempts,error_code AS "errorCode",created_at::text AS "createdAt"`;
const dto = (row: Record<string, unknown>) =>
  IngestionSchema.parse(
    Object.fromEntries(
      Object.keys(IngestionSchema.shape).map((key) => [key, row[key]]),
    ),
  );
async function event(c: PoolClient, profile: string, id: string, kind: string) {
  telemetry('report.event');
  await c.query(
    'INSERT INTO health_ingestion_events(profile_id,ingestion_id,event_type,trace_id) VALUES($1,$2,$3,$4)',
    [profile, id, kind, traceId()],
  );
}
async function locked(
  c: PoolClient,
  profile: string,
  id: string,
  revision: number,
) {
  const row = (
    await c.query(
      `SELECT ${columns} FROM health_ingestions WHERE profile_id=$1 AND id=$2 FOR UPDATE`,
      [profile, id],
    )
  ).rows[0];
  if (!row) throw new ReportError('REPORT_NOT_FOUND', 404);
  if (row.revision !== revision)
    throw new ReportError('REPORT_REVISION_CHANGED', 409);
  return dto(row);
}
export function createReportRepository(pool: Pool): ReportRepository {
  const tx = <T>(profile: string, work: (c: PoolClient) => Promise<T>) =>
    databaseTransaction(pool, work, profile);
  async function find(
    profile: string,
    id: string,
  ): Promise<ReportRecord | null> {
    return tx(profile, async (c) => {
      const row = (
        await c.query(
          `SELECT ${columns},object_id AS "objectId",actor_id AS "actorId",profile_id AS "profileId",request_key AS "requestKey",content_sha256 AS sha256 FROM health_ingestions WHERE profile_id=$1 AND id=$2`,
          [profile, id],
        )
      ).rows[0];
      return row
        ? {
            id: row.objectId,
            profileId: row.profileId,
            actorId: row.actorId,
            requestKey: row.requestKey,
            sha256: row.sha256,
            byteLength: row.byteLength,
            fileName: row.fileName,
            mediaType: row.mediaType,
            ingestion: dto(row),
          }
        : null;
    });
  }
  return {
    transaction: (profile, work) => tx(profile, work),
    find,
    async byRequest(profile, actor, key) {
      const id = await tx(
        profile,
        async (c) =>
          (
            await c.query(
              'SELECT id FROM health_ingestions WHERE profile_id=$1 AND actor_id=$2 AND request_key=$3',
              [profile, actor, key],
            )
          ).rows[0]?.id,
      );
      return id ? find(profile, id) : null;
    },
    async byDigest(profile, hash) {
      const id = await tx(
        profile,
        async (c) =>
          (
            await c.query(
              'SELECT id FROM health_ingestions WHERE profile_id=$1 AND content_sha256=$2',
              [profile, hash],
            )
          ).rows[0]?.id,
      );
      return id ? find(profile, id) : null;
    },
    async register(o) {
      return tx(o.profileId, async (c) => {
        await c.query(
          `INSERT INTO platform_private_objects(id,profile_id,actor_id,request_key,content_sha256,byte_length,purpose,media_type) VALUES($1,$2,$3,$4,$5,$6,'health_report',$7)`,
          [
            o.id,
            o.profileId,
            o.actorId,
            o.requestKey,
            o.sha256,
            o.byteLength,
            o.mediaType,
          ],
        );
        const row = (
          await c.query(
            `INSERT INTO health_ingestions(id,profile_id,actor_id,object_id,request_key,content_sha256,byte_length,media_type,file_name) VALUES($1,$2,$3,$1,$4,$5,$6,$7,$8) RETURNING ${columns}`,
            [
              o.id,
              o.profileId,
              o.actorId,
              o.requestKey,
              o.sha256,
              o.byteLength,
              o.mediaType,
              o.fileName,
            ],
          )
        ).rows[0];
        await event(c, o.profileId, o.id, 'report.uploaded.v1');
        return dto(row);
      });
    },
    async list(profile) {
      return tx(profile, async (c) =>
        (
          await c.query(
            `SELECT ${columns} FROM health_ingestions WHERE profile_id=$1 ORDER BY created_at DESC,id LIMIT 100`,
            [profile],
          )
        ).rows.map(dto),
      );
    },
    async act(profile, id, revision, action, actor) {
      return tx(profile, async (c) => {
        const old = await locked(c, profile, id, revision);
        if (
          action === 'retry' &&
          (old.state !== 'failed' || old.scanState === 'infected')
        )
          throw new ReportError('REPORT_NOT_RETRYABLE', 409);
        if (
          action === 'cancel' &&
          ![
            'queued',
            'processing',
            'failed',
            'review_needed',
            'quarantined',
            'verified',
          ].includes(old.state)
        )
          throw new ReportError('REPORT_NOT_CANCELLABLE', 409);
        const row = (
          await c.query(
            `UPDATE health_ingestions SET state=$3,attempts=CASE WHEN $3='queued' THEN 0 ELSE attempts END,available_at=now(),lease_token=NULL,lease_until=NULL,error_code=NULL,revision=revision+1,updated_at=now() WHERE profile_id=$1 AND id=$2 RETURNING ${columns}`,
            [profile, id, action === 'retry' ? 'queued' : 'cancelled'],
          )
        ).rows[0];
        if (action === 'cancel')
          await c.query(
            `INSERT INTO health_report_identity_actions(profile_id,report_id,actor_id,state,reason) SELECT $1,$2,$3,'quarantined','Report cancelled' FROM health_ingestions WHERE profile_id=$1 AND id=$2 AND EXISTS(SELECT 1 FROM health_diagnostic_reports WHERE profile_id=$1 AND id=$2)`,
            [profile, id, actor],
          );
        await event(c, profile, id, `report.${action}.v1`);
        return dto(row);
      });
    },
    async claim() {
      await pool.query(
        `UPDATE health_ingestions SET state='failed',error_code='ATTEMPTS_EXHAUSTED',lease_token=NULL,lease_until=NULL,revision=revision+1 WHERE state='processing' AND lease_until<=now() AND attempts>=max_attempts`,
      );
      const row = (
        await pool.query(
          `WITH q AS(SELECT id FROM health_ingestions WHERE attempts<max_attempts AND ((state='queued' AND available_at<=now()) OR(state='processing' AND lease_until<=now())) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE health_ingestions h SET state='processing',attempts=h.attempts+1,lease_token=$1,lease_until=now()+interval '10 minutes',revision=revision+1,updated_at=now() FROM q WHERE h.id=q.id RETURNING h.id,h.profile_id AS "profileId",h.actor_id AS "actorId",h.lease_token AS token`,
          [randomUUID()],
        )
      ).rows[0];
      if (row) {
        const parent = (
          await pool.query(
            'SELECT trace_id FROM health_ingestion_events WHERE ingestion_id=$1 ORDER BY id LIMIT 1',
            [row.id],
          )
        ).rows[0];
        telemetry('report.claim', {
          ...(parent ? { parentTraceId: parent.trace_id } : {}),
        });
      }
      return row ?? null;
    },
    async advance(lease) {
      return tx(lease.profileId, async (c) =>
        Boolean(
          (
            await c.query(
              "UPDATE health_ingestions SET stage='extract',scan_state='clean',revision=revision+1 WHERE profile_id=$1 AND id=$2 AND state='processing' AND lease_token=$3 AND lease_until>now() RETURNING id",
              [lease.profileId, lease.id, lease.token],
            )
          ).rowCount,
        ),
      );
    },
    async finish(lease, work) {
      return tx(lease.profileId, async (c) => {
        if (
          !(
            await c.query(
              `SELECT id FROM health_ingestions WHERE profile_id=$1 AND id=$2 AND state='processing' AND lease_token=$3 AND lease_until>now() FOR UPDATE`,
              [lease.profileId, lease.id, lease.token],
            )
          ).rowCount
        )
          return false;
        await work();
        return true;
      });
    },
    async failed(lease, code, scanState = 'pending') {
      await tx(lease.profileId, async (c) => {
        const terminal = [
          'MALWARE_DETECTED',
          'ACCESS_REVOKED',
          'INVALID_DOCUMENT',
          'PAGE_LIMIT',
          'ENCRYPTED_PDF',
          'SCANNER_UNAVAILABLE',
          'OCR_UNAVAILABLE',
        ].includes(code);
        const result = await c.query(
          `UPDATE health_ingestions SET state=CASE WHEN $4 OR attempts>=max_attempts THEN 'failed' ELSE 'queued' END,error_code=$5,scan_state=$6,available_at=now()+interval '30 seconds',lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=now() WHERE profile_id=$1 AND id=$2 AND state='processing' AND lease_token=$3`,
          [lease.profileId, lease.id, lease.token, terminal, code, scanState],
        );
        if (result.rowCount)
          await event(
            c,
            lease.profileId,
            lease.id,
            'report.processing_failed.v1',
          );
      });
    },
    async recordExtraction(record, pages, actor) {
      await tx(record.profileId, async (c) => {
        const profile = record.profileId,
          id = record.ingestion.id;
        await c.query(
          `INSERT INTO health_source_documents(id,profile_id,storage_object_id,content_sha256,media_type,byte_length,page_count,uploaded_by) VALUES($1,$2,$1,$3,$4,$5,$6,$7)`,
          [
            id,
            profile,
            record.sha256,
            record.mediaType,
            record.byteLength,
            pages.length,
            actor,
          ],
        );
        await c.query(
          'INSERT INTO health_diagnostic_reports(id,profile_id,document_id) VALUES($1,$2,$1)',
          [id, profile],
        );
        const names = new Set<string>();
        for (const [index, preview] of pages.entries()) {
          const { page } = preview;
          const pageId = randomUUID();
          await c.query(
            'INSERT INTO health_report_pages(id,profile_id,document_id,page_number,page_sha256,width_pixels,height_pixels) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [
              pageId,
              profile,
              id,
              index + 1,
              preview.hash,
              page.width,
              page.height,
            ],
          );
          await c.query(
            'INSERT INTO health_page_previews(id,profile_id,ingestion_id,page_id,page_number,content_sha256,byte_length,width,height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [
              preview.id,
              profile,
              id,
              pageId,
              index + 1,
              preview.hash,
              page.png.length,
              page.width,
              page.height,
            ],
          );
          for (const line of page.lines) {
            const field = randomUUID();
            await c.query(
              `INSERT INTO health_raw_fields(id,profile_id,document_id,report_id,page_id,raw_text,x0,y0,x1,y1,extractor_name,extractor_version,confidence) VALUES($1,$2,$3,$3,$4,$5,$6,$7,$8,$9,'local-layout','1.0.0',$10)`,
              [
                field,
                profile,
                id,
                pageId,
                line.text,
                line.box.x0,
                line.box.y0,
                line.box.x1,
                line.box.y1,
                line.confidence,
              ],
            );
            const patient = /^\s*patient(?:\s+name)?\s*[:-]\s*(.+)/i.exec(
              line.text,
            );
            if (patient) names.add(patient[1]!.trim().toLowerCase());
            const parsed = parseReportLine(line);
            if (parsed)
              await c.query(
                `INSERT INTO health_extraction_candidates(profile_id,report_id,raw_field_id,field_kind,parsed_value,parser_name,parser_version,confidence) VALUES($1,$2,$3,'observation',$4::jsonb,'conservative-row','1.0.0',$5)`,
                [profile, id, field, JSON.stringify(parsed), line.confidence],
              );
          }
        }
        const mixed = names.size > 1;
        await c.query(
          'INSERT INTO health_report_identity_actions(profile_id,report_id,actor_id,state,reason) VALUES($1,$2,$3,$4,$5)',
          [
            profile,
            id,
            actor,
            mixed ? 'quarantined' : 'pending',
            mixed
              ? 'Conflicting patient names detected'
              : 'Explicit subject confirmation required',
          ],
        );
        await c.query(
          `UPDATE health_ingestions SET state=$3,stage='review',scan_state='clean',error_code=NULL,lease_token=NULL,lease_until=NULL,revision=revision+1,updated_at=now() WHERE profile_id=$1 AND id=$2`,
          [profile, id, mixed ? 'quarantined' : 'review_needed'],
        );
        await event(c, profile, id, 'report.review_required.v1');
      });
    },
    async detail(profile, id) {
      return tx(profile, async (c) => ({
        report: (await find(profile, id))?.ingestion ?? null,
        identity:
          (
            await c.query(
              'SELECT sequence::text,state,reason FROM health_report_identity_actions WHERE profile_id=$1 AND report_id=$2 ORDER BY sequence DESC LIMIT 1',
              [profile, id],
            )
          ).rows[0] ?? null,
        candidates: (
          await c.query(
            `SELECT c.id,c.raw_field_id AS "rawFieldId",c.parsed_value AS parsed,c.confidence::text,p.page_number AS "pageNumber",f.raw_text AS "rawText",f.x0::text,f.y0::text,f.x1::text,f.y1::text,(SELECT r.observation_id FROM health_candidate_reviews r WHERE r.profile_id=c.profile_id AND r.candidate_id=c.id ORDER BY r.id DESC LIMIT 1) AS "observationId" FROM health_extraction_candidates c JOIN health_raw_fields f ON f.profile_id=c.profile_id AND f.id=c.raw_field_id JOIN health_report_pages p ON p.profile_id=f.profile_id AND p.id=f.page_id WHERE c.profile_id=$1 AND c.report_id=$2 ORDER BY p.page_number,f.y0,f.x0`,
            [profile, id],
          )
        ).rows,
        observations: (
          await c.query(
            `SELECT s.id,s.original_name AS name,s.original_value AS value,s.value_kind AS "valueKind",s.original_unit AS unit,s.reference_text AS "referenceText",s.reference_field_id AS "referenceFieldId",s.revision,s.previous_observation_id AS "previousObservationId",s.verification_state AS "verificationState",(SELECT json_build_object('conceptSystem',m.concept_system,'conceptCode',m.concept_code,'specimen',m.specimen,'method',m.method,'observedDate',m.observed_date::text,'sourceFieldId',m.source_field_id) FROM health_verified_context m WHERE m.profile_id=s.profile_id AND m.observation_id=s.id) AS metadata FROM health_effective_source_observations s WHERE s.profile_id=$1 AND s.report_id=$2 ORDER BY s.created_at`,
            [profile, id],
          )
        ).rows,
        rawFields: (
          await c.query(
            'SELECT f.id,f.raw_text AS text,p.page_number AS "pageNumber" FROM health_raw_fields f JOIN health_report_pages p ON p.profile_id=f.profile_id AND p.id=f.page_id WHERE f.profile_id=$1 AND f.report_id=$2 ORDER BY p.page_number,f.y0,f.x0',
            [profile, id],
          )
        ).rows,
        relationships: (
          await c.query(
            'SELECT id,related_report_id AS "relatedReportId",kind,reason FROM health_report_relationships WHERE profile_id=$1 AND report_id=$2 ORDER BY created_at,id',
            [profile, id],
          )
        ).rows,
        pages: (
          await c.query(
            'SELECT page_number AS number,width,height FROM health_page_previews WHERE profile_id=$1 AND ingestion_id=$2 ORDER BY page_number',
            [profile, id],
          )
        ).rows,
      }));
    },
    async preview(profile, id, page) {
      return tx(
        profile,
        async (c) =>
          (
            await c.query(
              `SELECT p.id,p.profile_id AS "profileId",h.actor_id AS "actorId",h.request_key AS "requestKey",p.content_sha256 AS sha256,p.byte_length AS "byteLength" FROM health_page_previews p JOIN health_ingestions h ON h.profile_id=p.profile_id AND h.id=p.ingestion_id WHERE p.profile_id=$1 AND p.ingestion_id=$2 AND p.page_number=$3 AND h.scan_state='clean' AND h.state<>'cancelled'`,
              [profile, id, page],
            )
          ).rows[0] ?? null,
      );
    },
    async reviewIdentity(profile, id, actor, data) {
      const input = IdentityReviewSchema.parse(data);
      return tx(profile, async (c) => {
        const old = await locked(c, profile, id, input.expectedRevision);
        if (
          old.scanState !== 'clean' ||
          !['review_needed', 'verified', 'quarantined'].includes(old.state)
        )
          throw new ReportError('IDENTITY_REVIEW_UNAVAILABLE', 409);
        const conflict = (
          await c.query(
            `SELECT 1 FROM health_report_identity_actions WHERE profile_id=$1 AND report_id=$2 AND reason='Conflicting patient names detected' LIMIT 1`,
            [profile, id],
          )
        ).rowCount;
        if (conflict && input.state === 'matched')
          throw new ReportError('MIXED_IDENTITY_REQUIRES_REUPLOAD', 409);
        await c.query(
          'INSERT INTO health_report_identity_actions(profile_id,report_id,actor_id,state,reason) VALUES($1,$2,$3,$4,$5)',
          [profile, id, actor, input.state, input.reason],
        );
        const row = (
          await c.query(
            `UPDATE health_ingestions SET state=$3,revision=revision+1,updated_at=now() WHERE profile_id=$1 AND id=$2 RETURNING ${columns}`,
            [
              profile,
              id,
              input.state === 'matched' ? 'review_needed' : 'quarantined',
            ],
          )
        ).rows[0];
        await event(c, profile, id, 'report.identity_reviewed.v1');
        return dto(row);
      });
    },
    async verify(profile, id, actor, data) {
      const input = VerificationInputSchema.parse(data);
      return tx(profile, async (c) => {
        const old = await locked(c, profile, id, input.expectedRevision);
        if (
          old.scanState !== 'clean' ||
          !['review_needed', 'verified'].includes(old.state)
        )
          throw new ReportError('VERIFICATION_UNAVAILABLE', 409);
        const identity = (
          await c.query(
            'SELECT sequence,state FROM health_report_identity_actions WHERE profile_id=$1 AND report_id=$2 ORDER BY sequence DESC LIMIT 1',
            [profile, id],
          )
        ).rows[0];
        if (identity?.state !== 'matched')
          throw new ReportError('IDENTITY_CONFIRMATION_REQUIRED', 409);
        const candidate = (
          await c.query(
            'SELECT raw_field_id FROM health_extraction_candidates WHERE profile_id=$1 AND report_id=$2 AND id=$3',
            [profile, id, input.candidateId],
          )
        ).rows[0];
        if (!candidate) throw new ReportError('CANDIDATE_NOT_FOUND', 404);
        const prior =
          (
            await c.query(
              'SELECT observation_id FROM health_candidate_reviews WHERE profile_id=$1 AND report_id=$2 AND candidate_id=$3 ORDER BY id DESC LIMIT 1',
              [profile, id, input.candidateId],
            )
          ).rows[0]?.observation_id ?? null;
        if (prior !== input.previousObservationId)
          throw new ReportError('OBSERVATION_REVISION_CHANGED', 409);
        let revision = 1;
        if (prior)
          revision =
            1 +
            Number(
              (
                await c.query(
                  'SELECT revision FROM health_source_observations WHERE profile_id=$1 AND id=$2',
                  [profile, prior],
                )
              ).rows[0].revision,
            );
        const v = input.value,
          oid = randomUUID();
        await c.query(
          `INSERT INTO health_source_observations(id,profile_id,report_id,candidate_id,original_name,original_value,original_unit,name_field_id,value_field_id,unit_field_id,value_kind,numeric_value,comparator,qualitative_value,missing_reason,revision,previous_observation_id,correction_reason,recorded_by,reference_text,reference_field_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [
            oid,
            profile,
            id,
            input.candidateId,
            input.originalName,
            v.kind === 'quantity'
              ? v.comparator + v.amount
              : v.kind === 'qualitative'
                ? v.text
                : v.reason,
            input.unit,
            candidate.raw_field_id,
            input.unit ? candidate.raw_field_id : null,
            v.kind,
            v.kind === 'quantity' ? v.amount : null,
            v.kind === 'quantity' ? v.comparator : null,
            v.kind === 'qualitative' ? v.text : null,
            v.kind === 'missing' ? v.reason : null,
            revision,
            prior,
            prior ? input.reason : null,
            actor,
            input.referenceText,
            input.referenceText
              ? (input.referenceFieldId ?? candidate.raw_field_id)
              : null,
          ],
        );
        await c.query(
          `INSERT INTO health_verification_actions(profile_id,report_id,observation_id,identity_action_sequence,actor_id,state,reason) VALUES($1,$2,$3,$4,$5,'verified',$6)`,
          [profile, id, oid, identity.sequence, actor, input.reason],
        );
        if (input.metadata) {
          const m = input.metadata;
          await c.query(
            'INSERT INTO health_verified_context(profile_id,report_id,observation_id,concept_system,concept_code,specimen,method,observed_date,source_field_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [
              profile,
              id,
              oid,
              m.conceptSystem,
              m.conceptCode,
              m.specimen,
              m.method,
              m.observedDate,
              m.sourceFieldId,
            ],
          );
        }
        await c.query(
          'INSERT INTO health_candidate_reviews(profile_id,report_id,candidate_id,observation_id,actor_id,reason) VALUES($1,$2,$3,$4,$5,$6)',
          [profile, id, input.candidateId, oid, actor, input.reason],
        );
        const remaining = (
          await c.query(
            `SELECT 1 FROM health_extraction_candidates c WHERE c.profile_id=$1 AND c.report_id=$2 AND NOT EXISTS(SELECT 1 FROM health_effective_source_observations s WHERE s.profile_id=c.profile_id AND s.candidate_id=c.id AND s.verification_state='verified') LIMIT 1`,
            [profile, id],
          )
        ).rowCount;
        await c.query(
          `UPDATE health_ingestions SET state=$3,stage=CASE WHEN $3='verified' THEN 'complete' ELSE 'review' END,revision=revision+1,updated_at=now() WHERE profile_id=$1 AND id=$2`,
          [profile, id, remaining ? 'review_needed' : 'verified'],
        );
        await event(c, profile, id, 'report.observation_verified.v1');
        return { observationId: oid, revision };
      });
    },
    async manualCandidate(profile, id, actor, data) {
      const input = ManualCandidateSchema.parse(data);
      return tx(profile, async (c) => {
        const prior = (
          await c.query(
            'SELECT raw_field_id FROM health_extraction_candidates WHERE profile_id=$1 AND report_id=$2 AND id=$3',
            [profile, id, input.requestKey],
          )
        ).rows[0];
        if (prior) {
          if (prior.raw_field_id !== input.rawFieldId)
            throw new ReportError('IDEMPOTENCY_CONFLICT', 409);
          return { candidateId: input.requestKey };
        }
        const report = await locked(c, profile, id, input.expectedRevision);
        if (!['review_needed', 'verified'].includes(report.state))
          throw new ReportError('VERIFICATION_UNAVAILABLE', 409);
        const source = (
          await c.query(
            'SELECT id FROM health_raw_fields WHERE profile_id=$1 AND report_id=$2 AND id=$3',
            [profile, id, input.rawFieldId],
          )
        ).rows[0];
        if (!source) throw new ReportError('SOURCE_NOT_FOUND', 404);
        await c.query(
          "INSERT INTO health_extraction_candidates(id,profile_id,report_id,raw_field_id,field_kind,parsed_value,parser_name,parser_version) VALUES($1,$2,$3,$4,'result',$5,'manual-source-selection','1.0.0')",
          [
            input.requestKey,
            profile,
            id,
            input.rawFieldId,
            {
              originalName: 'Unrecognized result',
              value: {
                kind: 'missing',
                reason: 'Not extracted; verification required',
              },
              unit: null,
              referenceText: null,
            },
          ],
        );
        await c.query(
          'INSERT INTO health_manual_candidate_actions(profile_id,report_id,candidate_id,actor_id,reason) VALUES($1,$2,$3,$4,$5)',
          [profile, id, input.requestKey, actor, input.reason],
        );
        await c.query(
          "UPDATE health_ingestions SET state='review_needed',stage='review',revision=revision+1,updated_at=now() WHERE profile_id=$1 AND id=$2",
          [profile, id],
        );
        return { candidateId: input.requestKey };
      });
    },
    async relate(profile, id, actor, data) {
      const input = ReportRelationshipSchema.parse(data);
      if (input.relatedReportId === id)
        throw new ReportError('DISTINCT_REPORT_REQUIRED');
      return tx(profile, async (c) => {
        const prior = (
          await c.query(
            'SELECT report_id,related_report_id,kind,reason FROM health_report_relationships WHERE profile_id=$1 AND id=$2',
            [profile, input.requestKey],
          )
        ).rows[0];
        if (prior) {
          if (
            prior.report_id !== id ||
            prior.related_report_id !== input.relatedReportId ||
            prior.kind !== input.kind ||
            prior.reason !== input.reason
          )
            throw new ReportError('IDEMPOTENCY_CONFLICT', 409);
          return { recorded: true };
        }
        for (const [rid, revision] of [
          [id, input.expectedRevision],
          [input.relatedReportId, input.relatedRevision],
        ].sort((a, b) => String(a[0]).localeCompare(String(b[0])))) {
          const row = await locked(c, profile, String(rid), Number(revision));
          if (row.state !== 'verified')
            throw new ReportError('VERIFIED_REPORT_REQUIRED', 409);
        }
        await c.query(
          'INSERT INTO health_report_relationships(id,profile_id,report_id,related_report_id,kind,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            input.requestKey,
            profile,
            id,
            input.relatedReportId,
            input.kind,
            input.reason,
            actor,
          ],
        );
        await c.query(
          'UPDATE health_ingestions SET revision=revision+1,updated_at=now() WHERE profile_id=$1 AND id IN($2,$3)',
          [profile, id, input.relatedReportId],
        );
        return { recorded: true };
      });
    },
    async observations(profile) {
      return tx(
        profile,
        async (c) =>
          (
            await c.query(
              `SELECT s.id,s.report_id AS "reportId",s.original_name AS name,s.original_value AS value,s.original_unit AS unit,s.numeric_value::text AS amount,s.comparator,m.method,m.observed_date::text AS date,m.concept_code AS "conceptCode",m.concept_system AS "conceptSystem",m.specimen,s.specimen_id AS "specimenId",s.revision,h.revision AS "reportRevision",p.page_number AS "pageNumber",s.value_field_id AS "rawFieldId" FROM health_effective_source_observations s JOIN health_ingestions h ON h.profile_id=s.profile_id AND h.id=s.report_id JOIN health_raw_fields f ON f.profile_id=s.profile_id AND f.id=s.value_field_id JOIN health_report_pages p ON p.profile_id=f.profile_id AND p.id=f.page_id LEFT JOIN health_verified_context m ON m.profile_id=s.profile_id AND m.observation_id=s.id WHERE s.profile_id=$1 AND s.verification_state='verified' AND h.state<>'cancelled' ORDER BY s.created_at DESC LIMIT 1000`,
              [profile],
            )
          ).rows,
      );
    },
    async ready() {
      await pool.query('SELECT id FROM health_ingestions LIMIT 0');
    },
  };
}
