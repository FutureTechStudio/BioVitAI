import type { Actor, AccountPrincipal } from '../contracts/auth.js';
import type {
  InvitationDelivery,
  ProfilePolicy,
  ProfileStore,
  ProfileTransaction,
  ConsentPurpose,
  ProfileScope,
  ProfileContext,
} from '../contracts/profiles.js';
import {
  AcceptInvitationSchema,
  ConsentSchema,
  CreateProfileSchema,
  IdSchema,
  InvitationSchema,
  ScopeSchema,
  ProfileContactSchema,
  ProfileError,
} from '../contracts/profiles.js';
import {
  ActiveProfileRefSchema,
  SelectProfileSchema,
} from '../../../../shared/contracts/src/profile-context.js';

export { ProfileError } from '../contracts/profiles.js';
const deny = () => new ProfileError(404, 'PROFILE_NOT_FOUND');

export function createProfileService(
  store: ProfileStore,
  delivery: InvitationDelivery,
  tokens: { create(): string; hash(token: string): string },
) {
  async function owner(tx: ProfileTransaction, actor: Actor, id: string) {
    const profile = await tx.lockProfile(IdSchema.parse(id));
    if (!profile || profile.ownerId !== actor.id) throw deny();
    return profile;
  }
  async function authorize(
    tx: ProfileTransaction,
    actor: AccountPrincipal,
    id: string,
    requested: ProfileScope,
    requiredConsent?: ConsentPurpose,
  ) {
    const scope = ScopeSchema.parse(requested);
    const profile = await tx.lockProfile(IdSchema.parse(id));
    if (!profile) throw deny();
    if (
      profile.ownerId !== actor.id &&
      (!(await tx.consent(id, 'family_sharing')) ||
        !(await tx.hasGrant(id, actor.id, scope)))
    )
      throw deny();
    if (
      scope.category === 'health' &&
      scope.purpose === 'wellness' &&
      !(await tx.consent(id, 'health_to_wellness'))
    )
      throw new ProfileError(403, 'CONSENT_REQUIRED');
    if (requiredConsent && !(await tx.consent(id, requiredConsent)))
      throw new ProfileError(403, 'CONSENT_REQUIRED');
    return profile;
  }
  async function context(tx: ProfileTransaction, actor: Actor) {
    const selection = await tx.lockContext(actor);
    if (!selection) throw new ProfileError(401, 'UNAUTHENTICATED');
    return selection;
  }
  const pickerScope = {
    category: 'profile',
    action: 'read',
    purpose: 'care',
  } as const;
  const policy: ProfilePolicy = {
    async withAccess(actor, id, requested, work, requiredConsent) {
      const scope = ScopeSchema.parse(requested);
      return store.transaction(async (tx) => {
        const profile = await authorize(tx, actor, id, scope, requiredConsent);
        const result = await work(profile);
        await tx.audit(
          id,
          actor.id,
          `access.${scope.category}.${scope.action}`,
          undefined,
          scope.purpose,
        );
        return result;
      });
    },
    async withActiveAccess(actor, expected, requested, work, requiredConsent) {
      const ref = ActiveProfileRefSchema.parse(expected);
      const scope = ScopeSchema.parse(requested);
      return store.transaction(async (tx) => {
        const selection = await context(tx, actor);
        if (
          selection.profileId !== ref.profileId ||
          selection.revision !== ref.revision
        )
          throw new ProfileError(409, 'PROFILE_CONTEXT_CHANGED');
        const profile = await authorize(
          tx,
          actor,
          ref.profileId,
          scope,
          requiredConsent,
        );
        const result = await work(profile);
        await tx.audit(
          profile.id,
          actor.id,
          `access.${scope.category}.${scope.action}`,
          undefined,
          scope.purpose,
        );
        return result;
      });
    },
  };
  return {
    ...policy,
    async create(actor: Actor, data: unknown) {
      const input = CreateProfileSchema.parse(data);
      return store.transaction(async (tx) => {
        const profile = await tx.createProfile(actor.id, input);
        if (!profile) throw new ProfileError(409, 'SELF_PROFILE_EXISTS');
        await tx.audit(profile.id, actor.id, 'profile.created');
        return profile;
      });
    },
    async current(actor: Actor): Promise<ProfileContext> {
      return store.transaction(async (tx) => {
        const selection = await context(tx, actor);
        if (!selection.profileId)
          return { profile: null, revision: selection.revision };
        try {
          const profile = await authorize(
            tx,
            actor,
            selection.profileId,
            pickerScope,
          );
          await tx.audit(
            profile.id,
            actor.id,
            'access.profile.read',
            undefined,
            'care',
          );
          return { profile, revision: selection.revision };
        } catch (error) {
          if (error instanceof ProfileError && error.status === 404) {
            const revision = await tx.selectProfile(actor.sessionId, null);
            return { profile: null, revision };
          }
          throw error;
        }
      });
    },
    async select(actor: Actor, data: unknown): Promise<ProfileContext> {
      const input = SelectProfileSchema.parse(data);
      return store.transaction(async (tx) => {
        const selection = await context(tx, actor);
        if (selection.revision !== input.expectedRevision)
          throw new ProfileError(409, 'PROFILE_CONTEXT_CHANGED');
        const profile = await authorize(
          tx,
          actor,
          input.profileId,
          pickerScope,
        );
        const revision = await tx.selectProfile(actor.sessionId, profile.id);
        await tx.audit(profile.id, actor.id, 'context.selected');
        return { profile, revision };
      });
    },
    async contact(actor: Actor, id: string) {
      return store.transaction(async (tx) => {
        await owner(tx, actor, id);
        return { email: await tx.contact(id) };
      });
    },
    async setContact(actor: Actor, id: string, data: unknown) {
      const input = ProfileContactSchema.parse(data);
      return store.transaction(async (tx) => {
        await owner(tx, actor, id);
        await tx.setContact(id, input.email);
        await tx.audit(id, actor.id, 'profile.contact_changed');
      });
    },
    async list(actor: Actor) {
      const profiles = [];
      for (const id of await store.candidateProfiles(actor.id)) {
        try {
          profiles.push(
            await policy.withAccess(
              actor,
              id,
              { category: 'profile', action: 'read', purpose: 'care' },
              async (profile) => profile,
            ),
          );
        } catch (error) {
          if (!(error instanceof ProfileError && error.status === 404))
            throw error;
        }
      }
      return profiles;
    },
    read(actor: Actor, id: string, purpose: 'care' | 'wellness') {
      return policy.withAccess(
        actor,
        id,
        { category: 'profile', action: 'read', purpose },
        async (profile) => profile,
      );
    },
    async consent(actor: Actor, id: string, data: unknown) {
      const input = ConsentSchema.parse(data);
      return store.transaction(async (tx) => {
        await owner(tx, actor, id);
        await tx.recordConsent(id, actor.id, input);
        if (input.purpose === 'family_sharing' && !input.granted)
          await tx.revoke(id);
        await tx.audit(
          id,
          actor.id,
          input.granted ? 'consent.granted' : 'consent.withdrawn',
          undefined,
          input.purpose,
        );
      });
    },
    async history(
      actor: Actor,
      id: string,
      kind: 'consents' | 'audit' | 'sharing',
    ) {
      return store.transaction(async (tx) => {
        await owner(tx, actor, id);
        if (kind === 'sharing') return tx.sharingHistory(id);
        return kind === 'consents'
          ? tx.consentHistory(id)
          : tx.auditHistory(id);
      });
    },
    async invite(actor: Actor, id: string, data: unknown) {
      const input = InvitationSchema.parse(data);
      const expiry = new Date(input.expiresAt);
      if (
        expiry.getTime() <= Date.now() ||
        expiry.getTime() > Date.now() + 90 * 86400000
      )
        throw new ProfileError(400, 'EXPIRY_OUT_OF_RANGE');
      if (input.email === actor.email.toLowerCase())
        throw new ProfileError(400, 'SELF_INVITATION');
      const token = tokens.create();
      const expiresAt = new Date(
        Math.min(expiry.getTime(), Date.now() + 86400000),
      );
      const invitationId = await store.transaction(async (tx) => {
        await owner(tx, actor, id);
        if (!(await tx.consent(id, 'family_sharing')))
          throw new ProfileError(403, 'CONSENT_REQUIRED');
        const invitationId = await tx.createInvitation(
          id,
          input,
          tokens.hash(token),
          expiresAt,
        );
        await tx.audit(
          id,
          actor.id,
          'invitation.created',
          invitationId,
          'family_sharing',
        );
        return invitationId;
      });
      // Delivery occurs only after commit. A failed capture cancels the invitation.
      try {
        await delivery.deliver({
          recipient: input.email,
          token,
          invitationId,
          expiresAt: expiresAt.toISOString(),
        });
      } catch (error) {
        await store.transaction(async (tx) => {
          await owner(tx, actor, id);
          await tx.revoke(id, invitationId);
          await tx.audit(
            id,
            actor.id,
            'invitation.delivery_failed',
            invitationId,
          );
        });
        throw error;
      }
      return { invitationId, expiresAt: expiresAt.toISOString() };
    },
    async accept(actor: Actor, data: unknown) {
      const { token } = AcceptInvitationSchema.parse(data);
      return store.transaction(async (tx) => {
        // Lookup is not an authorization decision; re-read after the profile lock.
        let invitation = await tx.invitation(tokens.hash(token));
        if (!invitation) throw new ProfileError(404, 'INVITATION_NOT_FOUND');
        await tx.lockProfile(invitation.profileId);
        invitation = await tx.invitation(tokens.hash(token));
        if (
          !invitation ||
          invitation.email !== actor.email.toLowerCase() ||
          invitation.acceptedAt ||
          invitation.revokedAt ||
          invitation.expiresAt.getTime() <= Date.now() ||
          !(await tx.consent(invitation.profileId, 'family_sharing'))
        )
          throw new ProfileError(404, 'INVITATION_NOT_FOUND');
        const grantId = await tx.acceptInvitation(invitation, actor.id);
        await tx.audit(
          invitation.profileId,
          actor.id,
          'invitation.accepted',
          grantId,
          'family_sharing',
        );
        return { grantId, profileId: invitation.profileId };
      });
    },
    async revoke(actor: Actor, id: string, resourceId: string) {
      IdSchema.parse(resourceId);
      return store.transaction(async (tx) => {
        await owner(tx, actor, id);
        if (!(await tx.revoke(id, resourceId)))
          throw new ProfileError(404, 'GRANT_NOT_FOUND');
        await tx.audit(
          id,
          actor.id,
          'sharing.revoked',
          resourceId,
          'family_sharing',
        );
      });
    },
  };
}
export type ProfileService = ReturnType<typeof createProfileService>;
