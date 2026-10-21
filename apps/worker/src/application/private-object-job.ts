import type {
  DurableJobs,
  JobFailure,
} from '../../../../shared/contracts/src/jobs.js';
import type { VerifiedAccounts } from '../../../../modules/identity/src/contracts/auth.js';
import { ProfileError } from '../../../../modules/identity/src/contracts/profiles.js';
import type { ProfilePolicy } from '../../../../modules/identity/src/contracts/profiles.js';
import { PrivateObjectError } from '../../../../modules/health/src/contracts/private-objects.js';
import type {
  PrivateObjectFiles,
  PrivateObjectMetadata,
} from '../../../../modules/health/src/contracts/private-objects.js';

export function createPrivateObjectWorker(
  jobs: DurableJobs,
  accounts: VerifiedAccounts,
  policy: ProfilePolicy,
  metadata: PrivateObjectMetadata,
  files: PrivateObjectFiles,
) {
  return {
    async runOnce() {
      await jobs.dispatch();
      const job = await jobs.claim();
      if (!job) return { status: 'idle' };
      try {
        const actor = await accounts.find(job.actorId);
        if (!actor) {
          const changed = await jobs.fail(job, 'ACCESS_REVOKED', true);
          return {
            status: changed ? 'cancelled' : 'lease_lost',
            jobId: job.id,
          };
        }
        const completed = await policy.withAccess(
          actor,
          job.profileId,
          { category: 'health', action: 'read', purpose: 'care' },
          async () => {
            const object = await metadata.find(job.profileId, job.objectId);
            if (!object) throw new PrivateObjectError('OBJECT_NOT_FOUND');
            await files.read(object);
            return jobs.complete(job, object.sha256);
          },
        );
        return {
          status: completed ? 'succeeded' : 'lease_lost',
          jobId: job.id,
        };
      } catch (error) {
        const code: JobFailure =
          error instanceof ProfileError
            ? 'ACCESS_REVOKED'
            : error instanceof PrivateObjectError &&
                error.code === 'INTEGRITY_FAILURE'
              ? 'INTEGRITY_FAILURE'
              : error instanceof PrivateObjectError
                ? 'OBJECT_UNAVAILABLE'
                : 'RETRYABLE_FAILURE';
        const changed = await jobs.fail(
          job,
          code,
          code === 'ACCESS_REVOKED' || code === 'INTEGRITY_FAILURE',
        );
        return {
          status: changed
            ? code === 'ACCESS_REVOKED'
              ? 'cancelled'
              : code === 'INTEGRITY_FAILURE'
                ? 'failed'
                : job.attempts >= job.maxAttempts
                  ? 'failed'
                  : 'retry_scheduled'
            : 'lease_lost',
          jobId: job.id,
        };
      }
    },
  };
}
