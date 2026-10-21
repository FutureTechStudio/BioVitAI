import { z } from 'zod';

export const PublicProfileSchema = z
  .object({
    id: z.uuid(),
    ownerId: z.string().min(1),
    displayName: z.string(),
    kind: z.enum(['self', 'family']),
  })
  .strict();
export type PublicProfile = z.infer<typeof PublicProfileSchema>;
export const ProfileContextSchema = z
  .object({
    profile: PublicProfileSchema.nullable(),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type PublicProfileContext = z.infer<typeof ProfileContextSchema>;
export const ProfileListSchema = z
  .object({
    profiles: z.array(PublicProfileSchema),
  })
  .strict();
export const CurrentAccountSchema = z
  .object({
    actor: z
      .object({
        id: z.string(),
        email: z.email(),
        emailVerified: z.literal(true),
      })
      .strict(),
  })
  .strict();
