import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getMigrations } from 'better-auth/db/migration';
import { readRuntimeConfig } from '../dist/infrastructure/config/runtime.js';
import { readIdentityConfig } from '../dist/infrastructure/config/identity.js';
import { createPostgresPool } from '../dist/infrastructure/db/postgres.js';
import { createIdentityAuth } from '../dist/modules/identity/src/infrastructure/auth.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = readRuntimeConfig(process.env);
const pool = createPostgresPool(config);
try {
  const identity = createIdentityAuth(
    pool,
    readIdentityConfig(process.env, config),
    {
      deliver: async () => {
        throw new Error('Schema generator cannot send email');
      },
    },
  );
  const migration = await getMigrations(identity.options);
  if (migration.unsafeChanges.length || migration.schemaProblems.length)
    throw new Error('Unsafe identity schema plan');
  const sql = await migration.compileMigrations();
  if (!sql.trim())
    throw new Error(
      'Use an empty development database to generate initial schema',
    );
  const directory = path.join(root, 'infrastructure/db/migrations');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, '0001_identity.sql'),
    `-- Generated from pinned Better Auth configuration; inspect before applying.\n${sql}\n`,
    { flag: 'wx' },
  );
  console.log(
    'Generated versioned identity SQL; existing files are never overwritten.',
  );
} finally {
  await pool.end();
}
