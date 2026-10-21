import { z } from 'zod';

export const ActiveProfileRefSchema = z
  .object({
    profileId: z.uuid(),
    revision: z.number().int().nonnegative().max(2147483647),
  })
  .strict();
export type ActiveProfileRef = z.infer<typeof ActiveProfileRefSchema>;
export const SelectProfileSchema = z
  .object({
    profileId: z.uuid(),
    expectedRevision: z.number().int().nonnegative().max(2147483646),
  })
  .strict();
