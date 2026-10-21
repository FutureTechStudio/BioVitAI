import { z } from 'zod';
import { ActiveProfileRefSchema } from './profile-context.js';
export const REPORT_MAX_BYTES = 20 * 1024 * 1024;
export const ReportContextSchema = ActiveProfileRefSchema;
export const ReportActionSchema = z
  .object({
    context: ActiveProfileRefSchema,
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const IdentityReviewSchema = ReportActionSchema.extend({
  confirmedSubject: z.literal(true),
  reason: z.string().trim().min(5).max(1000),
  state: z.enum(['matched', 'quarantined']),
}).strict();
export const ReportRelationshipSchema = ReportActionSchema.extend({
  requestKey: z.uuid(),
  relatedReportId: z.uuid(),
  relatedRevision: z.number().int().nonnegative(),
  kind: z.enum(['rerun', 'amendment']),
  reason: z.string().trim().min(5).max(1000),
}).strict();
export const ManualCandidateSchema = ReportActionSchema.extend({
  requestKey: z.uuid(),
  rawFieldId: z.uuid(),
  reason: z.string().trim().min(5).max(1000),
}).strict();
export const VerificationInputSchema = ReportActionSchema.extend({
  candidateId: z.uuid(),
  originalName: z.string().trim().min(1).max(300),
  value: z.discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('quantity'),
        amount: z
          .string()
          .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
          .max(100),
        comparator: z.enum(['=', '<', '<=', '>', '>=']),
      })
      .strict(),
    z
      .object({
        kind: z.literal('qualitative'),
        text: z.string().min(1).max(1000),
      })
      .strict(),
    z
      .object({
        kind: z.literal('missing'),
        reason: z.string().min(1).max(1000),
      })
      .strict(),
  ]),
  unit: z.string().trim().min(1).max(100).nullable(),
  referenceText: z.string().trim().min(1).max(1000).nullable().default(null),
  referenceFieldId: z.uuid().nullable().default(null),
  reason: z.string().trim().min(5).max(1000),
  previousObservationId: z.uuid().nullable().default(null),
  metadata: z
    .object({
      conceptSystem: z.string().trim().min(1).max(100).nullable().default(null),
      conceptCode: z.string().trim().min(1).max(100).nullable().default(null),
      specimen: z.string().trim().min(1).max(200).nullable().default(null),
      method: z.string().trim().min(1).max(200).nullable().default(null),
      observedDate: z.iso.date().nullable().default(null),
      sourceFieldId: z.uuid(),
    })
    .strict()
    .nullable()
    .default(null),
}).strict();
export const IngestionSchema = z
  .object({
    id: z.uuid(),
    fileName: z.string(),
    mediaType: z.string(),
    byteLength: z.number(),
    state: z.enum([
      'queued',
      'processing',
      'review_needed',
      'quarantined',
      'verified',
      'failed',
      'cancelled',
    ]),
    stage: z.enum(['scan', 'extract', 'review', 'complete']),
    scanState: z.enum(['pending', 'clean', 'infected', 'unavailable']),
    revision: z.number().int(),
    attempts: z.number().int(),
    errorCode: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();
export type Ingestion = z.infer<typeof IngestionSchema>;
export const ReportDetailSchema = z
  .object({
    report: IngestionSchema,
    identity: z
      .object({
        sequence: z.string(),
        state: z.enum(['pending', 'matched', 'quarantined']),
        reason: z.string(),
      })
      .nullable(),
    candidates: z.array(
      z.object({
        id: z.uuid(),
        rawFieldId: z.uuid(),
        parsed: z.object({
          originalName: z.string(),
          value: VerificationInputSchema.shape.value,
          unit: z.string().nullable(),
          referenceText: z.string().nullable(),
        }),
        confidence: z.string().nullable(),
        pageNumber: z.number(),
        rawText: z.string(),
        x0: z.string(),
        y0: z.string(),
        x1: z.string(),
        y1: z.string(),
        observationId: z.uuid().nullable(),
      }),
    ),
    observations: z.array(
      z.object({
        id: z.uuid(),
        name: z.string(),
        value: z.string(),
        unit: z.string().nullable(),
        revision: z.number(),
        previousObservationId: z.uuid().nullable(),
        verificationState: z.string(),
        valueKind: z.enum(['quantity', 'qualitative', 'missing']),
        referenceText: z.string().nullable().default(null),
        referenceFieldId: z.uuid().nullable().default(null),
        metadata: VerificationInputSchema.shape.metadata,
      }),
    ),
    pages: z.array(
      z.object({ number: z.number(), width: z.number(), height: z.number() }),
    ),
    relationships: z.array(
      z.object({
        id: z.uuid(),
        relatedReportId: z.uuid(),
        kind: z.enum(['rerun', 'amendment']),
        reason: z.string(),
      }),
    ),
    rawFields: z.array(
      z.object({
        id: z.uuid(),
        text: z.string(),
        pageNumber: z.number().int(),
      }),
    ),
  })
  .strict();
export type ReportDetail = z.infer<typeof ReportDetailSchema>;
