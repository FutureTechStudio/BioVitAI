import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import EmbeddedPostgres from 'embedded-postgres';
import { readRuntimeConfig } from '../dist/infrastructure/config/runtime.js';
import { readIdentityConfig } from '../dist/infrastructure/config/identity.js';
import { createLocalApplication } from '../dist/apps/api/src/bootstrap.js';
import {
  startNativePostgres,
  stopNativePostgres,
} from './stop-native-postgres.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const databaseDir = path.join(root, '.local/native-postgres');
let database;
let application;
let server;
let started = false;
let stopping = false;

async function stop() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10000);
  deadline.unref();
  try {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (application) await application.close();
    if (started) await stopNativePostgres();
  } finally {
    clearTimeout(deadline);
  }
}

async function main() {
  const config = readRuntimeConfig(process.env);
  if (
    config.PGHOST !== '127.0.0.1' ||
    config.PGDATABASE !== 'biovitai_dev' ||
    config.PGUSER !== 'biovitai_dev'
  )
    throw new Error(
      'Native local runner requires the generated local defaults',
    );
  database = new EmbeddedPostgres({
    databaseDir,
    user: config.PGUSER,
    password: config.PGPASSWORD,
    port: config.PGPORT,
    authMethod: 'scram-sha-256',
    persistent: true,
    postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => {},
    onError: () =>
      console.error(
        JSON.stringify({
          event: 'local.postgres_message',
          code: 'POSTGRES_DIAGNOSTIC',
        }),
      ),
  });
  await fs.mkdir(path.dirname(databaseDir), { recursive: true });
  let initialized = true;
  try {
    await fs.access(path.join(databaseDir, 'PG_VERSION'));
  } catch {
    initialized = false;
  }
  if (!initialized) await database.initialise();
  await startNativePostgres(config.PGPORT);
  started = true;
  const admin = new pg.Client({
    host: config.PGHOST,
    port: config.PGPORT,
    database: 'postgres',
    user: config.PGUSER,
    password: config.PGPASSWORD,
    connectionTimeoutMillis: 2000,
  });
  try {
    await admin.connect();
    const result = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.PGDATABASE],
    );
    if (!result.rowCount) await admin.query('CREATE DATABASE "biovitai_dev"');
  } finally {
    await admin.end();
  }
  application = createLocalApplication(
    config,
    readIdentityConfig(process.env, config),
    path.join(root, '.local/auth-mailbox'),
  );
  server = application.server;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.API_PORT, config.API_HOST, resolve);
  });
  console.log(
    JSON.stringify({
      event: 'local.started',
      url: `http://${config.API_HOST}:${config.API_PORT}`,
      dataMode: 'synthetic',
    }),
  );
}

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
main().catch(async () => {
  console.error(
    JSON.stringify({
      event: 'local.start_failed',
      code: 'LOCAL_START_FAILED',
      help: 'Check port availability, local settings and PostgreSQL binary support. Data has been preserved.',
    }),
  );
  await stop();
  process.exitCode = 1;
});
