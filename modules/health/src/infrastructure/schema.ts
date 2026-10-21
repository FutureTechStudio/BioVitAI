import type { Pool } from 'pg';

// Schema readiness only: no ingestion, clinical analysis or health HTTP route yet.
export async function checkHealthSchema(pool: Pool) {
  await pool.query(
    'SELECT profile_id, value_field_id, comparator, specimen_id, method, observed_precision FROM health_source_observations LIMIT 0',
  );
  await pool.query(
    'SELECT profile_id, verification_state FROM health_effective_source_observations LIMIT 0',
  );
  await pool.query(
    'SELECT profile_id, lineage_state FROM health_effective_aggregated_observations LIMIT 0',
  );
}
