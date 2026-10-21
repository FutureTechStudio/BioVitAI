import { z } from 'zod';
import { analyzeEvidence, compareEvidence } from '../domain/comparability.js';
import { ObservationEvidenceSchema } from '../../../../shared/contracts/src/intelligence.js';
import type { Actor } from '../../../identity/src/contracts/auth.js';
import type {
  ProfilePolicy,
  Profile,
} from '../../../identity/src/contracts/profiles.js';
import type { ActiveProfileRef } from '../../../../shared/contracts/src/profile-context.js';
import { ActiveProfileRefSchema } from '../../../../shared/contracts/src/profile-context.js';
import {
  ReportActionSchema,
  IdentityReviewSchema,
  VerificationInputSchema,
  REPORT_MAX_BYTES,
  ReportRelationshipSchema,
  ManualCandidateSchema,
} from '../../../../shared/contracts/src/reports.js';
import type {
  ReportRepository,
  ReportProcessor,
  ExtractedPage,
} from '../contracts/ingestion.js';
import { ReportError } from '../contracts/ingestion.js';
import type {
  PrivateObjectFiles,
  PrivateObjectSecurity,
} from '../contracts/private-objects.js';

export function detectReportMedia(bytes: Uint8Array) {
  const starts = (signature: number[]) =>
    signature.every((v, i) => bytes[i] === v);
  if (starts([37, 80, 68, 70, 45])) return 'application/pdf';
  if (starts([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png';
  if (starts([255, 216, 255])) return 'image/jpeg';
  if (starts([73, 73, 42, 0]) || starts([77, 77, 0, 42])) return 'image/tiff';
  if (
    starts([82, 73, 70, 70]) &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  )
    return 'image/webp';
  throw new ReportError('UNSUPPORTED_MEDIA_TYPE', 415);
}
export function createReportService(
  policy: ProfilePolicy,
  repo: ReportRepository,
  files: PrivateObjectFiles,
  security: PrivateObjectSecurity,
) {
  const read = { category: 'health', action: 'read', purpose: 'care' } as const;
  const write = { ...read, action: 'write' } as const;
  const access = <T>(
    actor: Actor,
    context: ActiveProfileRef,
    mutate: boolean,
    work: (profile: Profile) => Promise<T>,
  ) =>
    policy.withActiveAccess(
      actor,
      ActiveProfileRefSchema.parse(context),
      mutate ? write : read,
      work,
    );
  async function required(profile: string, id: string) {
    z.uuid().parse(id);
    const record = await repo.find(profile, id);
    if (!record) throw new ReportError('REPORT_NOT_FOUND', 404);
    return record;
  }
  async function visible(actor: Actor, profile: Profile, id: string) {
    const record = await required(profile.id, id);
    if (
      record.ingestion.state !== 'verified' &&
      record.actorId !== actor.id &&
      profile.ownerId !== actor.id
    )
      throw new ReportError('REPORT_NOT_FOUND', 404);
    return record;
  }
  return {
    authorizeUpload: (actor: Actor, context: ActiveProfileRef) =>
      access(actor, context, true, async () => {}),
    async upload(
      actor: Actor,
      context: ActiveProfileRef,
      bytes: Uint8Array,
      key: string,
      fileName: string,
    ) {
      z.uuid().parse(key);
      z.string().trim().min(1).max(200).parse(fileName);
      if (!bytes.length || bytes.length > REPORT_MAX_BYTES)
        throw new ReportError('REPORT_SIZE_LIMIT', 413);
      const mediaType = detectReportMedia(bytes);
      let created: string | null = null;
      try {
        return await access(actor, context, true, async () => {
          const hash = security.digest(bytes);
          const prior = await repo.byRequest(context.profileId, actor.id, key);
          if (prior) {
            if (prior.sha256 !== hash)
              throw new ReportError('IDEMPOTENCY_CONFLICT', 409);
            return prior.ingestion;
          }
          const duplicate = await repo.byDigest(context.profileId, hash);
          if (duplicate) return duplicate.ingestion;
          const id = security.id();
          await files.write(id, context.profileId, bytes);
          created = id;
          return repo.register({
            id,
            profileId: context.profileId,
            actorId: actor.id,
            requestKey: key,
            sha256: hash,
            byteLength: bytes.length,
            mediaType,
            fileName,
          });
        });
      } catch (error) {
        if (created) {
          // Do not delete a possibly committed original after an ambiguous commit acknowledgement.
          try {
            if (!(await repo.find(context.profileId, created)))
              await files.remove(created);
          } catch {
            throw new ReportError('RECONCILIATION_REQUIRED', 503);
          }
        }
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === '23505'
        )
          return access(actor, context, true, async () => {
            const prior = await repo.byRequest(
                context.profileId,
                actor.id,
                key,
              ),
              hash = security.digest(bytes);
            if (prior) {
              if (prior.sha256 !== hash)
                throw new ReportError('IDEMPOTENCY_CONFLICT', 409);
              return prior.ingestion;
            }
            const duplicate = await repo.byDigest(context.profileId, hash);
            if (duplicate) return duplicate.ingestion;
            throw new ReportError('IDEMPOTENCY_CONFLICT', 409);
          });
        throw error;
      }
    },
    list: (actor: Actor, context: ActiveProfileRef) =>
      access(actor, context, false, async (profile) => {
        const rows = await repo.list(context.profileId);
        if (profile.ownerId === actor.id) return rows;
        const result = [];
        for (const row of rows) {
          const record = await repo.find(context.profileId, row.id);
          if (row.state === 'verified' || record?.actorId === actor.id)
            result.push(row);
        }
        return result;
      }),
    detail: (actor: Actor, context: ActiveProfileRef, id: string) =>
      access(actor, context, false, async (profile) => {
        await visible(actor, profile, id);
        return repo.detail(context.profileId, id);
      }),
    async act(
      actor: Actor,
      id: string,
      data: unknown,
      action: 'retry' | 'cancel',
    ) {
      const input = ReportActionSchema.parse(data);
      return access(actor, input.context, true, () =>
        repo.act(
          input.context.profileId,
          z.uuid().parse(id),
          input.expectedRevision,
          action,
          actor.id,
        ),
      );
    },
    async identity(actor: Actor, id: string, data: unknown) {
      const input = IdentityReviewSchema.parse(data);
      return access(actor, input.context, true, () =>
        repo.reviewIdentity(
          input.context.profileId,
          z.uuid().parse(id),
          actor.id,
          input,
        ),
      );
    },
    async verify(actor: Actor, id: string, data: unknown) {
      const input = VerificationInputSchema.parse(data);
      return access(actor, input.context, true, () =>
        repo.verify(
          input.context.profileId,
          z.uuid().parse(id),
          actor.id,
          input,
        ),
      );
    },
    preview: (
      actor: Actor,
      context: ActiveProfileRef,
      id: string,
      page: number,
    ) =>
      access(actor, context, false, async (profile) => {
        z.uuid().parse(id);
        await visible(actor, profile, id);
        z.number().int().min(1).max(50).parse(page);
        const object = await repo.preview(context.profileId, id, page);
        if (!object) throw new ReportError('PAGE_NOT_FOUND', 404);
        return files.read(object);
      }),
    original: (actor: Actor, context: ActiveProfileRef, id: string) =>
      access(actor, context, false, async (profile) => {
        const record = await visible(actor, profile, id);
        if (
          record.ingestion.scanState !== 'clean' ||
          record.ingestion.state === 'cancelled'
        )
          throw new ReportError('ORIGINAL_UNAVAILABLE', 423);
        return { bytes: await files.read(record), mediaType: record.mediaType };
      }),
    manualCandidate: (actor: Actor, id: string, data: unknown) => {
      const input = ManualCandidateSchema.parse(data);
      return access(actor, input.context, true, () =>
        repo.manualCandidate(
          input.context.profileId,
          z.uuid().parse(id),
          actor.id,
          input,
        ),
      );
    },
    relate: (actor: Actor, id: string, data: unknown) => {
      const input = ReportRelationshipSchema.parse(data);
      return access(actor, input.context, true, () =>
        repo.relate(
          input.context.profileId,
          z.uuid().parse(id),
          actor.id,
          input,
        ),
      );
    },
    observations: (actor: Actor, context: ActiveProfileRef) =>
      access(actor, context, false, () => repo.observations(context.profileId)),
    intelligence: (
      actor: Actor,
      context: ActiveProfileRef,
      left?: string,
      right?: string,
    ) =>
      access(actor, context, false, async () => {
        const rows = z
          .array(ObservationEvidenceSchema)
          .parse(await repo.observations(context.profileId));
        return left && right
          ? compareEvidence(rows, z.uuid().parse(left), z.uuid().parse(right))
          : analyzeEvidence(rows);
      }),
  };
}
export type ReportService = ReturnType<typeof createReportService>;

export function createReportWorker(
  repo: ReportRepository,
  files: PrivateObjectFiles,
  security: PrivateObjectSecurity,
  policy: ProfilePolicy,
  accounts: {
    find(
      id: string,
    ): Promise<
      import('../../../identity/src/contracts/auth.js').AccountPrincipal | null
    >;
  },
  processor: ReportProcessor,
) {
  return {
    async runOnce() {
      const lease = await repo.claim();
      if (!lease) return { status: 'idle' };
      try {
        const actor = await accounts.find(lease.actorId);
        if (!actor) throw new ReportError('ACCESS_REVOKED', 403);
        const scope = {
          category: 'health',
          action: 'write',
          purpose: 'care',
        } as const;
        const record = await policy.withAccess(
          actor,
          lease.profileId,
          scope,
          async () => repo.find(lease.profileId, lease.id),
        );
        if (!record) throw new ReportError('REPORT_NOT_FOUND', 404);
        const bytes = await policy.withAccess(
          actor,
          lease.profileId,
          scope,
          () => files.read(record),
        );
        if ((await processor.scan(bytes)) !== 'clean')
          throw new ReportError('MALWARE_DETECTED');
        if (!(await repo.advance(lease))) return { status: 'stale' };
        const pages = await processor.extract(bytes, record.mediaType);
        if (!pages.length || pages.length > 50)
          throw new ReportError('PAGE_LIMIT');
        const previews: { page: ExtractedPage; id: string; hash: string }[] =
          [];
        for (const page of pages) {
          const id = security.id();
          await files.write(id, lease.profileId, page.png);
          previews.push({ page, id, hash: security.digest(page.png) });
        }
        // Recheck after slow scanning/OCR; lease fencing and publication share the authorization transaction.
        const current = await accounts.find(lease.actorId);
        if (!current) throw new ReportError('ACCESS_REVOKED', 403);
        const committed = await policy.withAccess(
          current,
          lease.profileId,
          scope,
          () =>
            repo.finish(lease, () =>
              repo.recordExtraction(record, previews, actor.id),
            ),
        );
        return { status: committed ? 'review_needed' : 'stale' };
      } catch (error) {
        const code =
          error instanceof ReportError
            ? error.code
            : error instanceof Error && error.message === 'PROFILE_NOT_FOUND'
              ? 'ACCESS_REVOKED'
              : 'PROCESSING_FAILED';
        await repo.failed(
          lease,
          code,
          code === 'MALWARE_DETECTED'
            ? 'infected'
            : code === 'SCANNER_UNAVAILABLE'
              ? 'unavailable'
              : 'pending',
        );
        return { status: 'failed', code };
      }
    },
  };
}
