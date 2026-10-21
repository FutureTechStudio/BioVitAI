import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSource, scan } from '../tools/check-boundaries.mjs';

test('repository respects architecture boundaries', () =>
  assert.deepEqual(scan(process.cwd()), []));
test('browser network access is isolated to the reviewed same-origin transport', () => {
  assert.deepEqual(
    inspectSource('apps/web/src/api.ts', 'fetch("/v1/me");'),
    [],
  );
  assert.ok(inspectSource('apps/web/src/shell.tsx', 'fetch("/v1/me");').length);
  assert.ok(
    inspectSource(
      'apps/web/src/api.ts',
      'import x from "../../../infrastructure/db/postgres.js";',
    ).length,
  );
  assert.ok(
    inspectSource('apps/web/src/api.ts', 'import x from "node:https";').length,
  );
});
test('rejects forbidden dependencies including dynamic import and re-export', () => {
  for (const [file, source] of [
    [
      'modules/wellness/src/application/plan.ts',
      'import x from "../../../health/src/infrastructure/db.js";',
    ],
    [
      'modules/ai/src/application/chat.ts',
      'const sdk = await import("openai");',
    ],
    [
      'apps/web/src/page.ts',
      'export * from "../../../modules/health/src/infrastructure/db.js";',
    ],
    ['modules/health/src/domain/observation.ts', 'import fs from "node:fs";'],
    [
      'modules/ai/src/application/chat.ts',
      'fetch("https://provider.invalid");',
    ],
    ['modules/ai/src/application/chat.ts', 'import(providerName);'],
  ])
    assert.ok(inspectSource(file, source).length, file);
});
test('allows public contracts and provider SDK in Gateway infrastructure', () => {
  assert.deepEqual(
    inspectSource(
      'modules/wellness/src/application/plan.ts',
      'import type { Evidence } from "../../../health/src/contracts/evidence.js";',
    ),
    [],
  );
  assert.deepEqual(
    inspectSource(
      'infrastructure/ai-gateway/provider.ts',
      'import SDK from "openai";',
    ),
    [],
  );
});

test('rejects package/path aliases that could bypass module ownership', () => {
  for (const specifier of [
    '@biovitai/health/infrastructure/db',
    '@/modules/health/db',
    '#health-db',
    '~/health/db',
  ]) {
    assert.ok(
      inspectSource(
        'modules/wellness/src/application/plan.ts',
        `import db from '${specifier}';`,
      ).length,
      specifier,
    );
  }
  assert.deepEqual(
    inspectSource(
      'modules/wellness/src/domain/goal.ts',
      "import type { EvidenceRef } from '@biovitai/contracts';",
    ),
    [],
  );
});

test('checks TypeScript import expressions, import-equals and literal template imports', () => {
  for (const source of [
    'type SDK = import("openai").Client;',
    'import SDK = require("openai");',
    'const sdk = await import(`openai`);',
  ])
    assert.ok(
      inspectSource('modules/ai/src/application/chat.ts', source).length,
      source,
    );
});

test('rejects application adapter dependencies and alternate network clients', () => {
  assert.ok(
    inspectSource(
      'modules/health/src/application/find.ts',
      'import db from "../infrastructure/db.js";',
    ).length,
  );
  for (const specifier of [
    'node:https',
    'http',
    'http2',
    'node:net',
    'tls',
    'axios',
    'undici',
  ]) {
    assert.ok(
      inspectSource(
        'modules/ai/src/application/chat.ts',
        `import client from '${specifier}';`,
      ).length,
      specifier,
    );
  }
  assert.ok(
    inspectSource(
      'modules/health/src/domain/value.ts',
      'import x from "zod-unapproved-adapter";',
    ).length,
  );
});
