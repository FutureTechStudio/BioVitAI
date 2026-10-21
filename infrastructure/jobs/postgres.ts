import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { databaseTransaction } from '../db/transaction.js';
import type {
  DurableJobs,
  PrivateObjectJob,
} from '../../shared/contracts/src/jobs.js';
import type { VerifiedAccounts } from '../../modules/identity/src/contracts/auth.js';

export function createVerifiedAccounts(pool: Pool): VerifiedAccounts {
  return {
    async find(id) {
      return (
        (
          await pool.query(
            'SELECT id,email,"emailVerified" FROM identity_user WHERE id=$1 AND "emailVerified"=true',
            [id],
          )
        ).rows[0] ?? null
      );
    },
  };
}
export function createDurableJobs(pool: Pool): DurableJobs {
  return {
    async dispatch(limit = 10) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new Error('Invalid dispatch limit');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const events = await client.query(
          'SELECT id,profile_id,actor_id,object_id FROM platform_outbox WHERE dispatched_at IS NULL ORDER BY occurred_at,id FOR UPDATE SKIP LOCKED LIMIT $1',
          [limit],
        );
        for (const event of events.rows) {
          await client.query(
            "INSERT INTO platform_jobs(id,profile_id,actor_id,object_id,event_id,kind) VALUES($1,$2,$3,$4,$1,'private_object.receipt.v1') ON CONFLICT(event_id) DO NOTHING",
            [event.id, event.profile_id, event.actor_id, event.object_id],
          );
          await client.query(
            'UPDATE platform_outbox SET dispatched_at=clock_timestamp() WHERE id=$1',
            [event.id],
          );
        }
        await client.query('COMMIT');
        return events.rowCount ?? 0;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async claim() {
      await pool.query(
        "UPDATE platform_jobs SET state='failed',lease_token=NULL,lease_until=NULL,finished_at=clock_timestamp(),last_error_code='RETRYABLE_FAILURE' WHERE attempts>=max_attempts AND (state='queued' OR (state='running' AND lease_until<=clock_timestamp()))",
      );
      return (
        (
          await pool.query<PrivateObjectJob>(
            'WITH candidate AS (SELECT id FROM platform_jobs WHERE attempts<max_attempts AND ((state=\'queued\' AND available_at<=clock_timestamp()) OR (state=\'running\' AND lease_until<=clock_timestamp())) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE platform_jobs j SET state=\'running\',attempts=j.attempts+1,lease_token=$1,lease_until=clock_timestamp()+interval \'30 seconds\' FROM candidate WHERE j.id=candidate.id RETURNING j.id,j.profile_id AS "profileId",j.actor_id AS "actorId",j.object_id AS "objectId",j.lease_token AS "leaseToken",j.attempts,j.max_attempts AS "maxAttempts"',
            [randomUUID()],
          )
        ).rows[0] ?? null
      );
    },
    async complete(job, sha256) {
      return databaseTransaction(
        pool,
        async (client) => {
          const current = await client.query(
            "SELECT id FROM platform_jobs WHERE id=$1 AND profile_id=$2 AND object_id=$3 AND state='running' AND lease_token=$4 AND lease_until>clock_timestamp() FOR UPDATE",
            [job.id, job.profileId, job.objectId, job.leaseToken],
          );
          if (!current.rowCount) {
            return false;
          }
          const object = await client.query(
            'SELECT content_sha256 FROM platform_private_objects WHERE profile_id=$1 AND id=$2',
            [job.profileId, job.objectId],
          );
          if (object.rows[0]?.content_sha256 !== sha256)
            throw new Error('Receipt integrity mismatch');
          await client.query(
            'INSERT INTO platform_job_receipts(job_id,profile_id,object_id,content_sha256) VALUES($1,$2,$3,$4) ON CONFLICT(job_id) DO NOTHING',
            [job.id, job.profileId, job.objectId, sha256],
          );
          await client.query(
            "UPDATE platform_jobs SET state='succeeded',lease_token=NULL,lease_until=NULL,last_error_code=NULL,finished_at=clock_timestamp() WHERE id=$1",
            [job.id],
          );
          return true;
        },
        job.profileId,
      );
    },
    async fail(job, code, terminal = false) {
      return (
        (
          await pool.query(
            "UPDATE platform_jobs SET state=CASE WHEN $3='ACCESS_REVOKED' THEN 'cancelled' WHEN $4 OR attempts>=max_attempts THEN 'failed' ELSE 'queued' END, available_at=clock_timestamp()+make_interval(secs=>LEAST(60,power(2,attempts))::integer),last_error_code=$3,finished_at=CASE WHEN $3='ACCESS_REVOKED' OR $4 OR attempts>=max_attempts THEN clock_timestamp() ELSE NULL END,lease_token=NULL,lease_until=NULL WHERE id=$1 AND state='running' AND lease_token=$2 AND lease_until>clock_timestamp()",
            [job.id, job.leaseToken, code, terminal],
          )
        ).rowCount === 1
      );
    },
    async ready() {
      await pool.query(
        'SELECT id,state,lease_token FROM platform_jobs LIMIT 0',
      );
      await pool.query('SELECT job_id FROM platform_job_receipts LIMIT 0');
    },
  };
}
