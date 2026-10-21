import { z } from 'zod';

const id = z.uuid();
const text = z.string().min(1).max(10000);
export const DecimalSchema = z
  .string()
  .max(1000)
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
export const ComparatorSchema = z.enum(['=', '<', '<=', '>', '>=']);
function greaterThan(left: string, right: string) {
  const fraction = (value: string) => value.split('.')[1]?.length ?? 0;
  const precision = Math.max(fraction(left), fraction(right));
  const scaled = (value: string) =>
    BigInt(value.replace('.', '') + '0'.repeat(precision - fraction(value)));
  return scaled(left) > scaled(right);
}
// Date-only/unknown input never becomes an invented midnight timestamp.
export const EvidenceTimeSchema = z.discriminatedUnion('precision', [
  z.object({ precision: z.literal('unknown') }).strict(),
  z.object({ precision: z.literal('date'), date: z.iso.date() }).strict(),
  z
    .object({
      precision: z.literal('instant'),
      at: z.iso.datetime({ offset: true }),
      timezone: z.string().min(1).max(100).nullable(),
    })
    .strict(),
]);
export const EvidenceValueSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('quantity'),
      amount: DecimalSchema,
      comparator: ComparatorSchema,
    })
    .strict(),
  z.object({ kind: z.literal('qualitative'), text }).strict(),
  z.object({ kind: z.literal('missing'), reason: text }).strict(),
]);
export const RawFieldSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    id,
    profileId: id,
    documentId: id,
    reportId: id,
    pageId: id,
    rawText: z.string().max(100000),
    box: z
      .object({
        x0: z.number().min(0).max(1),
        y0: z.number().min(0).max(1),
        x1: z.number().min(0).max(1),
        y1: z.number().min(0).max(1),
      })
      .strict()
      .refine(
        (box) => box.x0 < box.x1 && box.y0 < box.y1,
        'Box must have positive area',
      ),
    extractor: z
      .object({
        name: text,
        version: text,
        confidence: z.number().min(0).max(1).nullable(),
      })
      .strict(),
  })
  .strict();
export const SourceObservationSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    id,
    profileId: id,
    reportId: id,
    candidateId: id.nullable(),
    concept: z.object({ code: text, system: text }).strict().nullable(),
    original: z
      .object({
        name: text,
        value: z.string().max(10000),
        unit: text.nullable(),
        referenceText: text.nullable(),
      })
      .strict(),
    value: EvidenceValueSchema,
    sourceFields: z
      .object({
        name: id,
        value: id,
        unit: id.nullable(),
        reference: id.nullable(),
        method: id.nullable(),
        observedTime: id.nullable(),
        resultTime: id.nullable(),
      })
      .strict(),
    reference: z
      .object({
        low: DecimalSchema.nullable(),
        high: DecimalSchema.nullable(),
        context: z.record(z.string(), z.unknown()),
      })
      .strict(),
    specimenId: id.nullable(),
    method: text.nullable(),
    observedTime: EvidenceTimeSchema,
    resultTime: EvidenceTimeSchema,
    normalized: z
      .object({ amount: DecimalSchema, unit: text, ruleVersionId: id })
      .strict()
      .nullable(),
    revision: z.number().int().positive(),
    previousObservationId: id.nullable(),
    correctionReason: text.nullable(),
    recordedBy: id,
  })
  .strict()
  .superRefine((value, ctx) => {
    const fail = (path: string[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (
      value.reference.low !== null &&
      value.reference.high !== null &&
      DecimalSchema.safeParse(value.reference.low).success &&
      DecimalSchema.safeParse(value.reference.high).success &&
      greaterThan(value.reference.low, value.reference.high)
    )
      fail(['reference'], 'Reference range is reversed');
    if (value.original.unit !== null && !value.sourceFields.unit)
      fail(['sourceFields', 'unit'], 'Original unit requires raw evidence');
    if (
      (value.original.referenceText !== null ||
        value.reference.low !== null ||
        value.reference.high !== null) &&
      !value.sourceFields.reference
    )
      fail(
        ['sourceFields', 'reference'],
        'Reference range requires raw evidence',
      );
    if (value.method !== null && !value.sourceFields.method)
      fail(['sourceFields', 'method'], 'Method requires raw evidence');
    if (
      value.observedTime.precision !== 'unknown' &&
      !value.sourceFields.observedTime
    )
      fail(
        ['sourceFields', 'observedTime'],
        'Known time requires raw evidence',
      );
    if (
      value.resultTime.precision !== 'unknown' &&
      !value.sourceFields.resultTime
    )
      fail(
        ['sourceFields', 'resultTime'],
        'Known result time requires raw evidence',
      );
    if (value.normalized && value.value.kind !== 'quantity')
      fail(['normalized'], 'Only numeric quantities can be normalized');
    if (
      value.previousObservationId === null
        ? value.revision !== 1 || value.correctionReason !== null
        : value.previousObservationId === value.id ||
          value.revision < 2 ||
          value.correctionReason === null
    )
      fail(['revision'], 'Corrections require a prior observation and reason');
  });
export type SourceObservation = z.infer<typeof SourceObservationSchema>;
