import { z } from 'zod';
import type { Actor } from '../../../identity/src/contracts/auth.js';
import type { ProfilePolicy } from '../../../identity/src/contracts/profiles.js';
import { ActiveProfileRefSchema } from '../../../../shared/contracts/src/profile-context.js';
import type { ActiveProfileRef } from '../../../../shared/contracts/src/profile-context.js';
import {
  PrivateLinkSchema,
  PrivateObjectError,
} from '../contracts/private-objects.js';
import type {
  PrivateObjectFiles,
  PrivateObjectMetadata,
  PrivateObjectSecurity,
} from '../contracts/private-objects.js';

export function createPrivateObjects(
  policy: ProfilePolicy,
  metadata: PrivateObjectMetadata,
  files: PrivateObjectFiles,
  security: PrivateObjectSecurity,
  origin: string,
) {
  const read = { category: 'health', action: 'read', purpose: 'care' } as const;
  return {
    // Internal synthetic foundation operation, not an upload/scan API.
    async registerSynthetic(
      actor: Actor,
      context: ActiveProfileRef,
      bytes: Uint8Array,
      requestKey: string,
    ) {
      z.uuid().parse(requestKey);
      ActiveProfileRefSchema.parse(context);
      let createdId: string | null = null;
      try {
        return await policy.withActiveAccess(
          actor,
          context,
          { ...read, action: 'write' },
          async (profile) => {
            const sha256 = security.digest(bytes);
            const prior = await metadata.existing(
              profile.id,
              actor.id,
              requestKey,
            );
            if (prior) {
              if (prior.sha256 !== sha256 || prior.byteLength !== bytes.length)
                throw new PrivateObjectError('IDEMPOTENCY_CONFLICT');
              return prior;
            }
            const id = security.id();
            await files.write(id, profile.id, bytes);
            createdId = id;
            const stored = await metadata.register(
              {
                id,
                profileId: profile.id,
                actorId: actor.id,
                requestKey,
                sha256,
                byteLength: bytes.length,
              },
              security.id(),
            );
            if (stored.id !== id) await files.remove(id);
            return stored;
          },
        );
      } catch (error) {
        if (createdId) {
          try {
            // A lost COMMIT acknowledgement must not delete a committed object's bytes.
            if (!(await metadata.find(context.profileId, createdId)))
              await files.remove(createdId);
          } catch (cleanupError) {
            throw new AggregateError(
              [error, cleanupError],
              'Private object registration failed; reconciliation required',
              { cause: cleanupError },
            );
          }
        }
        throw error;
      }
    },
    async link(actor: Actor, data: unknown) {
      const input = PrivateLinkSchema.parse(data);
      return policy.withActiveAccess(
        actor,
        input.context,
        read,
        async (profile) => {
          if (!(await metadata.find(profile.id, input.objectId)))
            throw new PrivateObjectError('OBJECT_NOT_FOUND');
          const signed = security.issue({
            objectId: input.objectId,
            profileId: profile.id,
            actorId: actor.id,
            sessionId: actor.sessionId,
            revision: input.context.revision,
          });
          return {
            url: `${origin}/v1/storage/objects/${input.objectId}?ticket=${encodeURIComponent(signed.ticket)}`,
            expiresAt: new Date(signed.expiresAt * 1000).toISOString(),
          };
        },
      );
    },
    async download(actor: Actor, objectId: string, ticket: string) {
      z.uuid().parse(objectId);
      const value = security.verify(ticket);
      if (
        value.objectId !== objectId ||
        value.actorId !== actor.id ||
        value.sessionId !== actor.sessionId
      )
        throw new PrivateObjectError('INVALID_TICKET');
      return policy.withActiveAccess(
        actor,
        { profileId: value.profileId, revision: value.revision },
        read,
        async (profile) => {
          const object = await metadata.find(profile.id, objectId);
          if (!object) throw new PrivateObjectError('OBJECT_NOT_FOUND');
          return files.read(object);
        },
      );
    },
    async job(actor: Actor, context: ActiveProfileRef, id: string) {
      ActiveProfileRefSchema.parse(context);
      z.uuid().parse(id);
      return policy.withActiveAccess(actor, context, read, async (profile) => {
        const job = await metadata.jobStatus(profile.id, id);
        if (!job) throw new PrivateObjectError('OBJECT_NOT_FOUND');
        return job;
      });
    },
  };
}
export type PrivateObjects = ReturnType<typeof createPrivateObjects>;
