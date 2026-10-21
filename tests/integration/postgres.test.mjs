import assert from 'node:assert/strict';
import test from 'node:test';
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
import { createDatabaseProbe } from '../../dist/infrastructure/db/postgres.js';
import { createStatusService } from '../../dist/apps/api/src/application/status.js';

test(
  'real PostgreSQL probe detects availability, rejects wrong credentials and handles shutdown',
  { timeout: 90000 },
  async () => {
    const portServer = createServer();
    portServer.listen(0, '127.0.0.1');
    await once(portServer, 'listening');
    const port = portServer.address().port;
    await new Promise((resolve) => portServer.close(resolve));
    const testRoot = path.resolve('.local/tests');
    const directory = path.join(testRoot, randomUUID());
    const relative = path.relative(testRoot, path.resolve(directory));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
      throw new Error('Unsafe test cleanup target');
    await fs.mkdir(testRoot, { recursive: true });
    const password = randomBytes(32).toString('hex');
    const database = new EmbeddedPostgres({
      databaseDir: directory,
      user: 'biovitai_test',
      password,
      port,
      authMethod: 'scram-sha-256',
      persistent: true,
      postgresFlags: ['-h', '127.0.0.1'],
      onLog: () => {},
      onError: () => {},
    });
    let started = false;
    let probe;
    let invalid;
    try {
      await database.initialise();
      started = true;
      await startNativePostgres(port, directory);
      const config = readRuntimeConfig({
        NODE_ENV: 'test',
        PGPASSWORD: password,
        PGPORT: String(port),
        PGDATABASE: 'postgres',
        PGUSER: 'biovitai_test',
      });
      probe = createDatabaseProbe(config);
      const service = createStatusService(probe);
      assert.equal((await service.ready()).status, 'ok');
      invalid = createDatabaseProbe({
        ...config,
        PGPASSWORD: randomBytes(32).toString('hex'),
      });
      assert.equal(
        (await createStatusService(invalid).ready()).status,
        'unavailable',
      );
      await invalid.close();
      invalid = undefined;
      await stopNativePostgres(directory);
      started = false;
      assert.equal((await service.ready()).status, 'unavailable');
    } finally {
      if (invalid) await invalid.close();
      if (probe) await probe.close();
      if (started) await stopNativePostgres(directory);
      // Delete only this test's generated UUID directory under the resolved test root.
      await fs.rm(directory, { recursive: true, force: true });
    }
  },
);
