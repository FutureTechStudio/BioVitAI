import type { SessionReader } from '../contracts/auth.js';

export function createIdentityService(sessions: SessionReader) {
  return {
    async currentActor(headers: Record<string, string | undefined>) {
      // Identity comes solely from the authenticated session, never from body IDs.
      return sessions.currentActor(headers);
    },
  };
}
