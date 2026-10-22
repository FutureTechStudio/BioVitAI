import { z } from 'zod';
import { ActiveProfileRefSchema } from './profile-context.js';

export const StoryDateSchema = z
  .object({
    precision: z.enum(['unknown', 'year', 'month', 'day']),
    value: z.string().max(10).nullable(),
  })
  .strict()
  .refine(({ precision, value }) => {
    if (precision === 'unknown') return value === null;
    if (!value) return false;
    if (precision === 'year') return /^[1-9]\d{3}$/.test(value);
    if (precision === 'month')
      return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value);
    return /^[1-9]\d{3}-/.test(value) && z.iso.date().safeParse(value).success;
  }, 'Use a valid YYYY, YYYY-MM or YYYY-MM-DD date, or unknown');
export type StoryDate = z.infer<typeof StoryDateSchema>;
export function storyDate(value: string): StoryDate {
  const text = value.trim();
  return StoryDateSchema.parse({
    value: text || null,
    precision: !text
      ? 'unknown'
      : text.length === 4
        ? 'year'
        : text.length === 7
          ? 'month'
          : 'day',
  });
}
export function storyDateLabel(date: StoryDate) {
  return date.value
    ? `${date.value}${date.precision === 'day' ? '' : ' (approximate)'}`
    : 'Date unknown';
}
export function storyDateBounds(value: string): [string, string] {
  if (value.length === 4) return [value + '-01-01', value + '-12-31'];
  if (value.length === 7) return [value + '-01', value + '-31'];
  return [value, value];
}
const text = z.string().trim().min(1).max(1000);
const optionalText = z.string().trim().min(1).max(300).nullable();
export const StoryInformationSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('condition'),
      label: text.max(200),
      details: text,
      assertion: z.enum(['reported_condition', 'concern']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('medication'),
      label: text.max(200),
      details: text,
      strength: optionalText,
      dose: optionalText,
      route: optionalText,
      schedule: optionalText,
    })
    .strict(),
  z
    .object({
      kind: z.literal('care_guidance'),
      label: text.max(200),
      details: text,
      clinician: optionalText,
      followUp: StoryDateSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('allergy'),
      label: text.max(200),
      details: text,
      reaction: optionalText,
    })
    .strict(),
]);
export const StorySourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reported') }).strict(),
  z
    .object({
      kind: z.literal('document'),
      reportId: z.uuid(),
      pageNumber: z.number().int().min(1).max(50),
      excerpt: text,
    })
    .strict(),
]);
export const StoryContentSchema = z
  .object({
    information: StoryInformationSchema,
    start: StoryDateSchema,
    end: StoryDateSchema,
    state: z.enum([
      'current',
      'historical',
      'uncertain',
      'disputed',
      'entered_in_error',
    ]),
    source: StorySourceSchema,
    conflictsWith: z.array(z.uuid()).max(8),
  })
  .strict()
  .refine(
    (v) =>
      !v.start.value ||
      !v.end.value ||
      // Compare interval bounds, not invented exact dates for approximate entries.
      storyDateBounds(v.start.value)[0] <= storyDateBounds(v.end.value)[1],
    'End precedes start',
  )
  .refine(
    (v) => new Set(v.conflictsWith).size === v.conflictsWith.length,
    'Duplicate conflict link',
  );
export type StoryContent = z.infer<typeof StoryContentSchema>;
export const SaveStorySchema = z
  .object({
    context: ActiveProfileRefSchema,
    requestKey: z.uuid(),
    recordId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    reason: z.string().trim().min(5).max(1000),
    confirmed: z.literal(true),
    content: StoryContentSchema,
  })
  .strict();
export type SaveStory = z.infer<typeof SaveStorySchema>;
export const StoryRecordSchema = z
  .object({
    id: z.uuid(),
    versionId: z.uuid(),
    revision: z.number().int().positive(),
    recordedAt: z.string(),
    reporter: z.enum(['self', 'caregiver']),
    enteredByYou: z.boolean(),
    reason: z.string().nullable(),
    content: StoryContentSchema.nullable(),
    unavailableReason: z.literal('SOURCE_UNAVAILABLE').nullable(),
  })
  .strict();
export type StoryRecord = z.infer<typeof StoryRecordSchema>;
export const JourneyEventSchema = z
  .object({
    id: z.string(),
    kind: z.enum(['observation', 'context']),
    title: z.string(),
    detail: z.string(),
    date: StoryDateSchema,
    endDate: StoryDateSchema.nullable(),
    recordedAt: z.string(),
    revision: z.number().int(),
    authority: z.string(),
    reportId: z.uuid().nullable(),
    pageNumber: z.number().int().nullable(),
    rawFieldId: z.uuid().nullable(),
    recordId: z.uuid().nullable(),
    status: z.string(),
  })
  .strict();
export type JourneyEvent = z.infer<typeof JourneyEventSchema>;
export const JourneyQuerySchema = z
  .object({
    context: ActiveProfileRefSchema,
    offset: z.number().int().min(0).max(10000).default(0),
    expectedSnapshot: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    filter: z.enum(['all', 'observation', 'context']).default('all'),
    order: z.enum(['effective', 'recorded']).default('effective'),
    from: z.iso.date().nullable().default(null),
    to: z.iso.date().nullable().default(null),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'End precedes start');
export const ReviewJourneySchema = z
  .object({
    context: ActiveProfileRefSchema,
    requestKey: z.uuid(),
    snapshot: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const JourneySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    snapshot: z.string(),
    generatedAt: z.string(),
    canWrite: z.boolean(),
    firstReview: z.boolean(),
    reviewedAt: z.string().nullable(),
    records: z.array(StoryRecordSchema),
    events: z.array(JourneyEventSchema),
    nextOffset: z.number().int().nullable(),
    totalEvents: z.number().int(),
    summary: z
      .object({
        observations: z.number().int(),
        contextRecords: z.number().int(),
        undated: z.number().int(),
        earliest: z.string().nullable(),
        latest: z.string().nullable(),
      })
      .strict(),
    changes: z.array(
      z
        .object({
          id: z.string(),
          kind: z.enum(['added', 'updated', 'removed']),
          title: z.string(),
          detail: z.string(),
          reportId: z.uuid().nullable(),
          recordId: z.uuid().nullable(),
        })
        .strict(),
    ),
    totalChanges: z.number().int(),
    tasks: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          reason: z.string(),
          reportId: z.uuid().nullable(),
          recordId: z.uuid().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export type JourneySnapshot = z.infer<typeof JourneySnapshotSchema>;
