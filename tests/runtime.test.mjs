import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { readRuntimeConfig } from '../dist/infrastructure/config/runtime.js';
import { createStatusService } from '../dist/apps/api/src/application/status.js';
import { createApiServer } from '../dist/infrastructure/http/server.js';

const password = 'synthetic-test-password-not-for-use';

test('runtime config defaults to loopback synthetic data and never exposes invalid values', () => {
  const config = readRuntimeConfig({ PGPASSWORD: password });
  assert.equal(config.API_HOST, '127.0.0.1');
  assert.equal(config.DATA_MODE, 'synthetic');
  for (const extra of [
    { NODE_ENV: 'production' },
    { API_HOST: '0.0.0.0' },
    { PGHOST: 'remote.invalid' },
    { DATA_MODE: 'patient' },
    { PGPORT: 'bad' },
  ]) {
    assert.throws(
      () => readRuntimeConfig({ PGPASSWORD: password, ...extra }),
      (error) => !error.message.includes(password),
    );
  }
  assert.throws(
    () => readRuntimeConfig({ PGPASSWORD: 'secret' }),
    (error) => !error.message.includes('secret'),
  );
});

test('HTTP endpoints separate liveness from readiness and suppress sensitive failures', async (t) => {
  let healthy = false;
  const database = {
    check: async () => {
      if (!healthy)
        throw new Error(`postgres://user:${password}@private-host/db`);
    },
    close: async () => {},
  };
  const server = createApiServer(createStatusService(database));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const live = await fetch(`${base}/health/live`);
  assert.equal(live.status, 200);
  assert.equal(live.headers.get('cache-control'), 'no-store');
  assert.ok(live.headers.get('x-request-id'));
  let ready = await fetch(`${base}/health/ready`);
  assert.equal(ready.status, 503);
  assert.deepEqual(await ready.json(), {
    status: 'unavailable',
    service: 'biovitai-api',
  });
  healthy = true;
  ready = await fetch(`${base}/health/ready`);
  assert.equal(ready.status, 200);
  const unknown = await fetch(
    `${base}/v1/profiles/private-profile?password=${password}`,
  );
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.text()).includes(password), false);
  assert.equal(
    (await fetch(`${base}/health/live`, { method: 'POST' })).status,
    405,
  );
});

test('a stalled dependency cannot hold readiness open indefinitely', async () => {
  const service = createStatusService(
    { check: () => new Promise(() => {}), close: async () => {} },
    15,
  );
  assert.equal((await service.ready()).status, 'unavailable');
});

test('web proxy origin is exact; missing and forged origins remain forbidden', async (t) => {
  const server = createApiServer(
    createStatusService({ check: async () => {}, close: async () => {} }),
    {
      origin: 'http://127.0.0.1:3001',
      webOrigin: 'http://127.0.0.1:3000',
      currentActor: async () => null,
      handler: async () => Response.json({ received: true }),
    },
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [origin, expected] of [
    [undefined, 403],
    ['http://evil.invalid', 403],
    ['http://127.0.0.1:3000.evil.invalid', 403],
    ['http://127.0.0.1:3000', 200],
    ['http://127.0.0.1:3001', 200],
  ]) {
    const response = await fetch(`${base}/api/auth/sign-out`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(origin ? { origin } : {}),
        'x-forwarded-host': '127.0.0.1:3000',
      },
      body: '{}',
    });
    assert.equal(response.status, expected);
  }
});
