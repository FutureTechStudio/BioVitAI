import { z } from 'zod';
import { ActiveProfileRefSchema } from '../../../../shared/contracts/src/profile-context.js';

export const PrivateLinkSchema = z
  .object({ objectId: z.uuid(), context: ActiveProfileRefSchema })
  .strict();
export interface StoredObject {
  id: string;
  profileId: string;
  actorId: string;
  requestKey: string;
  sha256: string;
  byteLength: number;
}
export interface PrivateObjectFiles {
  write(objectId: string, profileId: string, bytes: Uint8Array): Promise<void>;
  read(object: StoredObject): Promise<Uint8Array>;
  remove(objectId: string): Promise<void>;
}
export interface PrivateObjectMetadata {
  existing(
    profileId: string,
    actorId: string,
    requestKey: string,
  ): Promise<StoredObject | null>;
  register(object: StoredObject, traceId: string): Promise<StoredObject>;
  find(profileId: string, id: string): Promise<StoredObject | null>;
  jobStatus(profileId: string, id: string): Promise<unknown | null>;
  ready(): Promise<void>;
}
export const DownloadTicketSchema = z
  .object({
    version: z.literal(1),
    objectId: z.uuid(),
    profileId: z.uuid(),
    actorId: z.uuid(),
    sessionId: z.uuid(),
    revision: z.number().int().nonnegative(),
    expiresAt: z.number().int().positive(),
  })
  .strict();
export type DownloadTicket = z.infer<typeof DownloadTicketSchema>;
export interface PrivateObjectSecurity {
  id(): string;
  digest(bytes: Uint8Array): string;
  issue(input: Omit<DownloadTicket, 'version' | 'expiresAt'>): {
    ticket: string;
    expiresAt: number;
  };
  verify(ticket: string): DownloadTicket;
}
export class PrivateObjectError extends Error {
  constructor(
    public readonly code:
      | 'OBJECT_NOT_FOUND'
      | 'INTEGRITY_FAILURE'
      | 'OBJECT_TOO_LARGE'
      | 'IDEMPOTENCY_CONFLICT'
      | 'INVALID_TICKET'
      | 'OBJECT_UNAVAILABLE',
  ) {
    super(code);
  }
}
