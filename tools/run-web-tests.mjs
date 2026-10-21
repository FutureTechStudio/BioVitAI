import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { postgresFixture, freePort } from '../tests/helpers/postgres.mjs';
import { migrateDatabase } from '../dist/infrastructure/db/migrations.js';
import { createLocalApplication } from '../dist/apps/api/src/bootstrap.js';
import { createReportWorker } from '../dist/modules/health/src/application/reports.js';
import { createReportRepository } from '../dist/modules/health/src/infrastructure/reports.js';
import {
  createLocalPrivateFiles,
  createPrivateObjectSecurity,
} from '../dist/infrastructure/storage/local-private.js';
import { createProfileService } from '../dist/modules/identity/src/application/profiles.js';
import {
  createProfileStore,
  invitationTokens,
} from '../dist/modules/identity/src/infrastructure/profiles.js';
import { createVerifiedAccounts } from '../dist/infrastructure/jobs/postgres.js';
import { createLocalReportProcessor } from '../dist/infrastructure/reports/local-processor.js';
import { withTrace } from '../dist/infrastructure/observability/tracing.js';

// No .env loading, fixed ports, live development DB or external services.
const children = new Set();
const cancellation = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => cancellation.abort());

function start(args, env, inherit = false) {
  cancellation.signal.throwIfAborted();
  const child = spawn(process.execPath, args, {
    env,
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  children.add(child);
  // Framework output can contain callback URLs. Drain without logging them.
  child.stdout?.resume();
  child.stderr?.resume();
  const done = new Promise((resolve, reject) => {
    child.once('error', (error) => {
      children.delete(child);
      reject(error);
    });
    child.once('exit', (code) => {
      children.delete(child);
      resolve(code);
    });
  });
  const abort = () => child.kill();
  cancellation.signal.addEventListener('abort', abort, { once: true });
  void done
    .finally(() => cancellation.signal.removeEventListener('abort', abort))
    .catch(() => {});
  return { child, done };
}

async function main() {
  let fixture;
  let application;
  let listening = false;
  let workerStopped = false,
    workerLoop;
  try {
    fixture = await postgresFixture();
    await migrateDatabase(
      fixture.pool,
      path.resolve('infrastructure/db/migrations'),
    );
    const apiPort = await freePort();
    const webPort = await freePort();
    const origin = `http://127.0.0.1:${apiPort}`;
    const webOrigin = `http://127.0.0.1:${webPort}`;
    const mailbox = path.join(fixture.directory, 'mailbox');
    const secret = randomBytes(48).toString('hex');
    application = createLocalApplication(
      { ...fixture.config, API_PORT: apiPort },
      {
        origin,
        webOrigin,
        secret,
      },
      mailbox,
      path.join(fixture.directory, 'private-objects'),
    );
    application.server.listen(apiPort, '127.0.0.1');
    await once(application.server, 'listening');
    listening = true;
    const ready = await fetch(`${origin}/health/ready`, {
      signal: AbortSignal.timeout(5000),
    });
    if (ready.status !== 200) throw new Error('ISOLATED_API_NOT_READY');
    if (process.argv.includes('--reports')) {
      const worker = createReportWorker(
        createReportRepository(fixture.pool),
        createLocalPrivateFiles(
          path.join(fixture.directory, 'private-objects'),
          secret,
          20 * 1024 * 1024,
        ),
        createPrivateObjectSecurity(secret),
        createProfileService(
          createProfileStore(fixture.pool),
          { deliver: async () => {} },
          invitationTokens,
        ),
        createVerifiedAccounts(fixture.pool),
        createLocalReportProcessor(),
      );
      workerLoop = (async () => {
        while (!workerStopped) {
          await withTrace(() => worker.runOnce());
          await delay(250);
        }
      })();
    }
    const workspace = path.join(fixture.directory, 'workspace');
    const web = path.join(workspace, 'apps/web');
    await fs.cp(path.resolve('apps/web'), web, {
      recursive: true,
      filter: (source) =>
        !['.next', 'node_modules'].includes(path.basename(source)) &&
        !source.endsWith('.tsbuildinfo'),
    });
    await fs.cp(path.resolve('shared'), path.join(workspace, 'shared'), {
      recursive: true,
    });
    const env = {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      BIOVITAI_REPORT_REHEARSAL: process.argv.includes('--reports') ? '1' : '0',
      BIOVITAI_TEST_API_PORT: String(apiPort),
      BIOVITAI_TEST_ORIGIN: webOrigin,
      BIOVITAI_TEST_MAILBOX: mailbox,
      BIOVITAI_TEST_SCREENSHOTS: fixture.directory,
      COMMUNITY_ENABLED: process.argv.includes('--community-off')
        ? 'false'
        : 'true',
    };
    console.log('Isolated browser gate: building the web app');
    const nextCli = path.resolve('node_modules/next/dist/bin/next');
    const build = start([nextCli, 'build', web, '--webpack'], env, true);
    if ((await build.done) !== 0) throw new Error('ISOLATED_WEB_BUILD_FAILED');
    const running = start(
      [
        nextCli,
        'start',
        web,
        '--hostname',
        '127.0.0.1',
        '--port',
        String(webPort),
      ],
      env,
    );
    let available = false;
    for (
      let attempt = 0;
      attempt < 60 && !cancellation.signal.aborted;
      attempt++
    ) {
      if (running.child.exitCode !== null)
        throw new Error('ISOLATED_WEB_EXITED');
      try {
        const response = await fetch(`${webOrigin}/auth`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok) {
          available = true;
          break;
        }
      } catch {
        /* Next has not bound its socket yet. */
      }
      await delay(250, undefined, { signal: cancellation.signal });
    }
    if (!available) throw new Error('ISOLATED_WEB_NOT_READY');
    console.log(
      `Isolated browser gate: Community ${env.COMMUNITY_ENABLED === 'false' ? 'off' : 'on'}`,
    );
    const tests = start(
      [path.resolve('node_modules/@playwright/test/cli.js'), 'test'],
      env,
      true,
    );
    if ((await tests.done) !== 0)
      throw new Error('ISOLATED_BROWSER_TESTS_FAILED');
  } finally {
    workerStopped = true;
    if (workerLoop) await workerLoop;
    await Promise.all(
      [...children].map(async (child) => {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
        child.stdout?.destroy();
        child.stderr?.destroy();
      }),
    );
    if (application) {
      if (listening) {
        application.server.closeAllConnections();
        await new Promise((resolve) => application.server.close(resolve));
      }
      await application.close();
    }
    if (fixture) await fixture.close();
    console.log(
      'Isolated browser gate: temporary services and data cleaned up',
    );
  }
}
main().catch(() => {
  console.error('Isolated browser gate failed; see the test failure above.');
  process.exitCode = 1;
});
