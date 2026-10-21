import { readRuntimeConfig } from '../dist/infrastructure/config/runtime.js';
import { createPostgresPool } from '../dist/infrastructure/db/postgres.js';
const pool = createPostgresPool(readRuntimeConfig(process.env));
try {
  const queue = (
    await pool.query(
      'SELECT state,stage,scan_state AS scan,count(*)::int AS count FROM health_ingestions GROUP BY state,stage,scan_state ORDER BY state,stage',
    )
  ).rows;
  const quality = (
    await pool.query(
      'SELECT count(*)::int AS candidates,round(avg(confidence)::numeric,3)::text AS mean_confidence FROM health_extraction_candidates',
    )
  ).rows;
  const permissions = {
    source: 'api.complete trace status 401/403/404',
    databaseDenialCount:
      'not recorded; failed authorization transactions roll back',
  };
  const usage = (
    await pool.query(
      "SELECT day::text,committed_microusd::text FROM ai_daily_budget WHERE day=(now() AT TIME ZONE 'Asia/Kolkata')::date",
    )
  ).rows;
  console.log(JSON.stringify({ queue, quality, permissions, usage }));
} catch {
  console.error(
    'Pilot metrics unavailable. No payload or database error text logged.',
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
