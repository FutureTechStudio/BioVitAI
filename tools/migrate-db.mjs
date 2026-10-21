import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRuntimeConfig } from '../dist/infrastructure/config/runtime.js';
import { createPostgresPool } from '../dist/infrastructure/db/postgres.js';
import { migrateDatabase } from '../dist/infrastructure/db/migrations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pool = createPostgresPool(readRuntimeConfig(process.env));
try {
  await migrateDatabase(pool, path.join(root, 'infrastructure/db/migrations'));
  console.log('Database migrations verified/applied.');
} catch {
  console.error(
    'Database migration failed; inspect schema, version checksums and connection settings. No sensitive error details logged.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
