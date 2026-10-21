import pg from 'pg';
import type { RuntimeConfig } from '../config/runtime.js';
import type { DatabaseProbe } from '../../shared/contracts/src/runtime.js';

export function createPostgresPool(config: RuntimeConfig) {
  const pool = new pg.Pool({
    host: config.PGHOST,
    port: config.PGPORT,
    database: config.PGDATABASE,
    user: config.PGUSER,
    password: config.PGPASSWORD,
    ssl: false, // RuntimeConfig permits loopback-only synthetic development.
    max: 5,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    query_timeout: 2000,
    statement_timeout: 2000,
    application_name: 'biovitai-foundation',
    types: {
      getTypeParser(oid, format) {
        // A calendar date is not an instant. Preserve DATE as YYYY-MM-DD.
        if (oid === 1082 && format !== 'binary')
          return (value: string) => value;
        return pg.types.getTypeParser(oid, format);
      },
    },
  });
  // pg emits an error for idle connections on database restarts. Handle it without
  // dumping raw connection details. A subsequent readiness probe retries afresh.
  pool.on('error', () => {
    console.warn(JSON.stringify({ event: 'database.idle_connection_lost' }));
  });
  return pool;
}

export function createDatabaseProbe(config: RuntimeConfig): DatabaseProbe {
  const pool = createPostgresPool(config);
  return {
    async check() {
      await pool.query('SELECT 1');
    },
    async close() {
      await pool.end();
    },
  };
}
