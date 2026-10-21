import { z } from 'zod';
import type { Actor, AccountPrincipal } from './auth.js';
import type { ActiveProfileRef } from '../../../../shared/contracts/src/profile-context.js';
export class ProfileError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export const ConsentPurposeSchema = z.enum([
  'family_sharing',
  'health_ai',
  'wellness_ai',
  'health_to_wellness',
  'connectors',
  'notifications',
]);
export type ConsentPurpose = z.infer<typeof ConsentPurposeSchema>;
export const ScopeSchema = z
  .object({
    category: z.enum(['profile', 'health', 'wellness']),
    action: z.enum(['read', 'write']),
    purpose: z.enum(['care', 'wellness']),
  })
  .strict();
export type ProfileScope = z.infer<typeof ScopeSchema>;
export const CreateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    kind: z.enum(['self', 'family']).default('self'),
    contactEmail: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase())
      .optional(),
  })
  .strict();
export const ProfileContactSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase())
      .nullable(),
  })
  .strict();
export const ConsentSchema = z
  .object({
    purpose: ConsentPurposeSchema,
    noticeVersion: z.literal('pilot-v1'),
    granted: z.boolean(),
  })
  .strict();
export const InvitationSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    role: z.enum(['viewer', 'caregiver']),
    scopes: z.array(ScopeSchema).min(1).max(12),
    expiresAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (value) =>
      value.role !== 'viewer' ||
      value.scopes.every((scope) => scope.action === 'read'),
    'Viewers can only read',
  );
export const AcceptInvitationSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const IdSchema = z.uuid();
export interface Profile {
  id: string;
  ownerId: string;
  displayName: string;
  kind: 'self' | 'family';
}
export interface ProfileSelection {
  profileId: string | null;
  revision: number;
}
export interface ProfileContext {
  profile: Profile | null;
  revision: number;
}
export interface Invitation {
  id: string;
  profileId: string;
  email: string;
  role: 'viewer' | 'caregiver';
  scopes: ProfileScope[];
  expiresAt: Date;
  grantExpiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}
export interface ProfileTransaction {
  createProfile(
    actorId: string,
    input: z.infer<typeof CreateProfileSchema>,
  ): Promise<Profile | null>;
  lockContext(actor: Actor): Promise<ProfileSelection | null>;
  selectProfile(sessionId: string, profileId: string | null): Promise<number>;
  contact(profileId: string): Promise<string | null>;
  setContact(profileId: string, email: string | null): Promise<void>;
  lockProfile(id: string): Promise<Profile | null>;
  consent(profileId: string, purpose: ConsentPurpose): Promise<boolean>;
  recordConsent(
    profileId: string,
    actorId: string,
    input: z.infer<typeof ConsentSchema>,
  ): Promise<void>;
  hasGrant(
    profileId: string,
    actorId: string,
    scope: ProfileScope,
  ): Promise<boolean>;
  createInvitation(
    profileId: string,
    input: z.infer<typeof InvitationSchema>,
    hash: string,
    inviteExpiry: Date,
  ): Promise<string>;
  invitation(hash: string): Promise<Invitation | null>;
  acceptInvitation(invitation: Invitation, actorId: string): Promise<string>;
  revoke(profileId: string, id?: string): Promise<boolean>;
  audit(
    profileId: string,
    actorId: string,
    event: string,
    resourceId?: string,
    purpose?: string,
  ): Promise<void>;
  consentHistory(profileId: string): Promise<unknown[]>;
  auditHistory(profileId: string): Promise<unknown[]>;
  sharingHistory(profileId: string): Promise<unknown[]>;
}
export interface ProfileStore {
  transaction<T>(work: (tx: ProfileTransaction) => Promise<T>): Promise<T>;
  candidateProfiles(actorId: string): Promise<string[]>;
  ready(): Promise<void>;
}
export interface InvitationDelivery {
  deliver(input: {
    recipient: string;
    token: string;
    invitationId: string;
    expiresAt: string;
  }): Promise<void>;
}
export interface ProfilePolicy {
  // Every API/tool/worker must use this boundary around the protected operation.
  // No reusable allow token or cached authorization snapshot is returned.
  withAccess<T>(
    actor: AccountPrincipal,
    profileId: string,
    scope: ProfileScope,
    work: (profile: Profile) => Promise<T>,
    consent?: ConsentPurpose,
  ): Promise<T>;
  withActiveAccess<T>(
    actor: Actor,
    expected: ActiveProfileRef,
    scope: ProfileScope,
    work: (profile: Profile) => Promise<T>,
    consent?: ConsentPurpose,
  ): Promise<T>;
}
