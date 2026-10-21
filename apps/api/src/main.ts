import { readRuntimeConfig } from '../../../infrastructure/config/runtime.js';
import { readIdentityConfig } from '../../../infrastructure/config/identity.js';
import path from 'node:path';
import { createLocalApplication } from './bootstrap.js';

async function main() {
  const config = readRuntimeConfig(process.env);
  const application = createLocalApplication(
    config,
    readIdentityConfig(process.env, config),
    path.resolve('.local/auth-mailbox'),
  );
  const { server } = application;
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.API_PORT, config.API_HOST, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  console.log(
    JSON.stringify({
      event: 'api.started',
      port: config.API_PORT,
      dataMode: config.DATA_MODE,
    }),
  );
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    server.closeIdleConnections();
    server.close(async () => {
      await application.close();
      clearTimeout(deadline);
      console.log(JSON.stringify({ event: 'api.stopped' }));
    });
  }
  process.once('SIGINT', () => void stop());
  process.once('SIGTERM', () => void stop());
}

main().catch(() => {
  console.error(
    JSON.stringify({ event: 'api.start_failed', code: 'STARTUP_FAILED' }),
  );
  process.exitCode = 1;
});
