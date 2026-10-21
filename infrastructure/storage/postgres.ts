import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { databaseTransaction } from '../db/transaction.js';
import { PrivateObjectError } from '../../modules/health/src/contracts/private-objects.js';
import type {
  PrivateObjectMetadata,
  StoredObject,
} from '../../modules/health/src/contracts/private-objects.js';

const columns =
  'id, profile_id AS "profileId", actor_id AS "actorId", request_key AS "requestKey", content_sha256 AS sha256, byte_length AS "byteLength"';
export function createPrivateObjectMetadata(pool: Pool): PrivateObjectMetadata {
  return {
    async existing(profileId, actorId, requestKey) {
      return databaseTransaction(
        pool,
        async (client) =>
          (
            await client.query<StoredObject>(
              `SELECT ${columns} FROM platform_private_objects WHERE profile_id=$1 AND actor_id=$2 AND request_key=$3`,
              [profileId, actorId, requestKey],
            )
          ).rows[0] ?? null,
        profileId,
      );
    },
    async register(object, traceId) {
      return databaseTransaction(
        pool,
        async (client) => {
          const inserted = await client.query<StoredObject>(
            `INSERT INTO platform_private_objects(id,profile_id,actor_id,request_key,content_sha256,byte_length) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(profile_id,actor_id,request_key) DO NOTHING RETURNING ${columns}`,
            [
              object.id,
              object.profileId,
              object.actorId,
              object.requestKey,
              object.sha256,
              object.byteLength,
            ],
          );
          const existing =
            inserted.rows[0] ??
            (
              await client.query<StoredObject>(
                `SELECT ${columns} FROM platform_private_objects WHERE profile_id=$1 AND actor_id=$2 AND request_key=$3`,
                [object.profileId, object.actorId, object.requestKey],
              )
            ).rows[0]!;
          if (
            existing.sha256 !== object.sha256 ||
            existing.byteLength !== object.byteLength
          )
            throw new PrivateObjectError('IDEMPOTENCY_CONFLICT');
          if (inserted.rowCount)
            await client.query(
              "INSERT INTO platform_outbox(id,profile_id,actor_id,object_id,event_type,trace_id,idempotency_key) VALUES($1,$2,$3,$4,'platform.private_object.stored.v1',$5,$6)",
              [
                randomUUID(),
                object.profileId,
                object.actorId,
                object.id,
                traceId,
                object.requestKey,
              ],
            );
          return existing;
        },
        object.profileId,
      );
    },
    async find(profileId, id) {
      return databaseTransaction(
        pool,
        async (client) =>
          (
            await client.query<StoredObject>(
              `SELECT ${columns} FROM platform_private_objects WHERE profile_id=$1 AND id=$2 AND purpose='foundation_fixture'`,
              [profileId, id],
            )
          ).rows[0] ?? null,
        profileId,
      );
    },
    async jobStatus(profileId, id) {
      return databaseTransaction(
        pool,
        async (client) =>
          (
            await client.query(
              'SELECT id,state,attempts,max_attempts AS "maxAttempts",last_error_code AS "lastErrorCode",finished_at AS "finishedAt" FROM platform_jobs WHERE profile_id=$1 AND id=$2',
              [profileId, id],
            )
          ).rows[0] ?? null,
        profileId,
      );
    },
    async ready() {
      await pool.query(
        'SELECT id,profile_id FROM platform_private_objects LIMIT 0',
      );
      await pool.query('SELECT id FROM platform_outbox LIMIT 0');
    },
  };
}
