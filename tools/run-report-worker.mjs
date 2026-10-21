import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { readRuntimeConfig } from '../dist/infrastructure/config/runtime.js';
import { readIdentityConfig } from '../dist/infrastructure/config/identity.js';
import { createPostgresPool } from '../dist/infrastructure/db/postgres.js';
import {
  createProfileStore,
  invitationTokens,
} from '../dist/modules/identity/src/infrastructure/profiles.js';
import { createProfileService } from '../dist/modules/identity/src/application/profiles.js';
import { createReportWorker } from '../dist/modules/health/src/application/reports.js';
import { createReportRepository } from '../dist/modules/health/src/infrastructure/reports.js';
import {
  createLocalPrivateFiles,
  createPrivateObjectSecurity,
} from '../dist/infrastructure/storage/local-private.js';
import { createVerifiedAccounts } from '../dist/infrastructure/jobs/postgres.js';
import { createLocalReportProcessor } from '../dist/infrastructure/reports/local-processor.js';
import { withTrace } from '../dist/infrastructure/observability/tracing.js';
const runtime = readRuntimeConfig(process.env),
  config = readIdentityConfig(process.env, runtime),
  pool = createPostgresPool(runtime);
const abort = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => abort.abort());
const profiles = createProfileService(
  createProfileStore(pool),
  {
    deliver: async () => {
      throw new Error('Worker cannot invite');
    },
  },
  invitationTokens,
);
const worker = createReportWorker(
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
try {
  while (!abort.signal.aborted) {
    const result = await withTrace(() => worker.runOnce());
    if (result.status !== 'idle')
      console.log(JSON.stringify({ event: 'report.worker', ...result }));
    await delay(result.status === 'idle' ? 1000 : 25, undefined, {
      signal: abort.signal,
    });
  }
} catch {
  if (!abort.signal.aborted) {
    console.error(
      JSON.stringify({
        event: 'report.worker_stopped',
        code: 'WORKER_FAILURE',
      }),
    );
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}
