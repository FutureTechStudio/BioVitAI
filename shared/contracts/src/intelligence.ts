import { z } from 'zod';
export const ObservationEvidenceSchema = z
  .object({
    id: z.uuid(),
    reportId: z.uuid(),
    name: z.string(),
    value: z.string(),
    unit: z.string().nullable(),
    amount: z.string().nullable(),
    comparator: z.string().nullable(),
    method: z.string().nullable(),
    date: z.string().nullable(),
    conceptCode: z.string().nullable(),
    conceptSystem: z.string().nullable(),
    specimen: z.string().nullable(),
    specimenId: z.uuid().nullable(),
    revision: z.number().int(),
    reportRevision: z.number().int(),
    pageNumber: z.number().int(),
    rawFieldId: z.uuid(),
  })
  .strict();
export type ObservationEvidence = z.infer<typeof ObservationEvidenceSchema>;
export const HealthAnalysisSchema = z.object({
  version: z.string(),
  cohorts: z.array(
    z.object({
      label: z.string(),
      unit: z.string().nullable(),
      observations: z.array(ObservationEvidenceSchema),
    }),
  ),
  exclusions: z.array(
    z.object({ observation: ObservationEvidenceSchema, reason: z.string() }),
  ),
  organs: z.array(
    z.object({ name: z.string(), state: z.string(), reason: z.string() }),
  ),
});
