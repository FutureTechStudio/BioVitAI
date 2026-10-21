import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type pg from 'pg';

// Versioned SQL is applied explicitly by a developer command, never per HTTP request.
export async function migrateDatabase(pool: pg.Pool, directory: string) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(184226001)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS biovitai_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const files = (await fs.readdir(directory))
      .filter((name) => /^\d{4}_[a-z_]+\.sql$/.test(name))
      .sort();
    for (const file of files) {
      const sql = await fs.readFile(path.join(directory, file), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const previous = await client.query<{ checksum: string }>(
        'SELECT checksum FROM biovitai_migrations WHERE version = $1',
        [file],
      );
      if (previous.rowCount) {
        if (previous.rows[0]?.checksum !== checksum)
          throw new Error('Applied migration checksum mismatch');
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO biovitai_migrations(version, checksum) VALUES ($1, $2)',
          [file, checksum],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock(184226001)');
    } finally {
      client.release();
    }
  }
}
