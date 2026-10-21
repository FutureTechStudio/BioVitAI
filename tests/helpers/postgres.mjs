import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import EmbeddedPostgres from 'embedded-postgres';
import {
  startNativePostgres,
  stopNativePostgres,
} from '../../tools/stop-native-postgres.mjs';
import { readRuntimeConfig } from '../../dist/infrastructure/config/runtime.js';
import { createPostgresPool } from '../../dist/infrastructure/db/postgres.js';

export async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function postgresFixture() {
  const testRoot = path.resolve('.local/tests');
  const directory = path.join(testRoot, randomUUID());
  const relative = path.relative(testRoot, path.resolve(directory));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('Unsafe fixture directory');
  await fs.mkdir(testRoot, { recursive: true });
  const port = await freePort();
  const password = randomBytes(32).toString('hex');
  const database = new EmbeddedPostgres({
    databaseDir: directory,
    user: 'biovitai_test',
    password,
    port,
    authMethod: 'scram-sha-256',
    persistent: true,
    onLog: () => {},
    onError: () => {},
  });
  let pool;
  try {
    await database.initialise();
    await startNativePostgres(port, directory);
    const config = readRuntimeConfig({
      NODE_ENV: 'test',
      PGPASSWORD: password,
      PGPORT: String(port),
      PGDATABASE: 'postgres',
      PGUSER: 'biovitai_test',
    });
    pool = createPostgresPool(config);
    return {
      config,
      pool,
      directory,
      async close() {
        await pool.end();
        await stopNativePostgres(directory);
        await fs.rm(directory, { recursive: true, force: true });
        await fs.rm(path.join(testRoot, `${path.basename(directory)}.log`), {
          force: true,
        });
      },
    };
  } catch (error) {
    if (pool) await pool.end();
    await stopNativePostgres(directory);
    await fs.rm(directory, { recursive: true, force: true });
    throw error;
  }
}
