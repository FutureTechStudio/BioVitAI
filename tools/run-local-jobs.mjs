import path from 'node:path';
import { readRuntimeConfig } from '../dist/infrastructure/config/runtime.js';
import { readIdentityConfig } from '../dist/infrastructure/config/identity.js';
import { createPostgresPool } from '../dist/infrastructure/db/postgres.js';
import {
  createDurableJobs,
  createVerifiedAccounts,
} from '../dist/infrastructure/jobs/postgres.js';
import { createPrivateObjectMetadata } from '../dist/infrastructure/storage/postgres.js';
import { createLocalPrivateFiles } from '../dist/infrastructure/storage/local-private.js';
import {
  createProfileStore,
  invitationTokens,
} from '../dist/modules/identity/src/infrastructure/profiles.js';
import { createProfileService } from '../dist/modules/identity/src/application/profiles.js';
import { createPrivateObjectWorker } from '../dist/apps/worker/src/application/private-object-job.js';
import { createReportWorker } from '../dist/modules/health/src/application/reports.js';
import { createReportRepository } from '../dist/modules/health/src/infrastructure/reports.js';
import { createPrivateObjectSecurity } from '../dist/infrastructure/storage/local-private.js';
import { createLocalReportProcessor } from '../dist/infrastructure/reports/local-processor.js';

const runtime = readRuntimeConfig(process.env);
const config = readIdentityConfig(process.env, runtime);
const pool = createPostgresPool(runtime);
try {
  const profiles = createProfileService(
    createProfileStore(pool),
    {
      deliver: async () => {
        throw Error('Worker cannot send invitations');
      },
    },
    invitationTokens,
  );
  const worker = createPrivateObjectWorker(
    createDurableJobs(pool),
    createVerifiedAccounts(pool),
    profiles,
    createPrivateObjectMetadata(pool),
    createLocalPrivateFiles(
      path.resolve('.local/private-objects'),
      config.secret,
    ),
  );
  const result = await worker.runOnce();
  const reportWorker = createReportWorker(
    createReportRepository(pool),
    createLocalPrivateFiles(
      path.resolve('.local/private-objects'),
      config.secret,
      20 * 1024 * 1024,
    ),
    createPrivateObjectSecurity(config.secret),
    profiles,
    createVerifiedAccounts(pool),
    createLocalReportProcessor(),
  );
  const reportResult = await (
    await import('../dist/infrastructure/observability/tracing.js')
  ).withTrace(() => reportWorker.runOnce());
  console.log(
    JSON.stringify({ event: 'jobs.local_run', status: result.status }),
  );
  console.log(JSON.stringify({ event: 'jobs.report_run', ...reportResult }));
} catch {
  console.error(JSON.stringify({ event: 'jobs.local_failed' }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
