import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type { Pool } from 'pg';
import { databaseTransaction } from '../db/transaction.js';
import type { ConversationStore } from '../../shared/contracts/src/conversations.js';
export function createConversationStore(
  pool: Pool,
  secret: string,
): ConversationStore {
  const key = createHash('sha256')
    .update('biovitai.conversations.v1:' + secret)
    .digest();
  function encrypt(profile: string, id: string, value: unknown) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(profile + ':' + id));
    return Buffer.concat([
      iv,
      cipher.update(JSON.stringify(value)),
      cipher.final(),
      cipher.getAuthTag(),
    ]);
  }
  function decrypt(profile: string, id: string, bytes: Buffer) {
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    cipher.setAAD(Buffer.from(profile + ':' + id));
    cipher.setAuthTag(bytes.subarray(-16));
    return JSON.parse(
      Buffer.concat([
        cipher.update(bytes.subarray(12, -16)),
        cipher.final(),
      ]).toString('utf8'),
    );
  }
  return {
    claim: (profile, key, fingerprint) =>
      databaseTransaction(
        pool,
        async (c) => {
          const result = await c.query(
            'INSERT INTO ai_request_claims(profile_id,request_key,fingerprint) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
            [profile, key, fingerprint],
          );
          if (result.rowCount) return true;
          const row = (
            await c.query(
              'SELECT fingerprint FROM ai_request_claims WHERE profile_id=$1 AND request_key=$2',
              [profile, key],
            )
          ).rows[0];
          if (row.fingerprint !== fingerprint)
            throw new Error('IDEMPOTENCY_CONFLICT');
          return false;
        },
        profile,
      ),
    digest: (value) =>
      createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    list: (profile) =>
      databaseTransaction(
        pool,
        async (c) =>
          (
            await c.query(
              'SELECT id,created_at::text AS "createdAt" FROM ai_conversations WHERE profile_id=$1 ORDER BY created_at DESC LIMIT 50',
              [profile],
            )
          ).rows,
        profile,
      ),
    messages: (profile, id) =>
      databaseTransaction(
        pool,
        async (c) =>
          (
            await c.query(
              'SELECT id,ciphertext,evidence_revision AS "evidenceRevision" FROM ai_messages WHERE profile_id=$1 AND conversation_id=$2 ORDER BY created_at,id LIMIT 100',
              [profile, id],
            )
          ).rows.map((row) => ({
            ...decrypt(profile, row.id, row.ciphertext),
            evidenceRevision: row.evidenceRevision,
          })),
        profile,
      ),
    prior: (profile, request) =>
      databaseTransaction(
        pool,
        async (c) => {
          const row = (
            await c.query(
              'SELECT id,conversation_id AS "conversationId",ciphertext,evidence_revision AS "evidenceRevision" FROM ai_messages WHERE profile_id=$1 AND request_key=$2',
              [profile, request],
            )
          ).rows[0];
          return row
            ? {
                ...decrypt(profile, row.id, row.ciphertext),
                conversationId: row.conversationId,
                evidenceRevision: row.evidenceRevision,
              }
            : null;
        },
        profile,
      ),
    save: (input) =>
      databaseTransaction(
        pool,
        async (c) => {
          await c.query(
            'INSERT INTO ai_conversations(id,profile_id,created_by) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',
            [input.conversationId, input.profileId, input.actorId],
          );
          const id = randomUUID();
          await c.query(
            'INSERT INTO ai_messages(id,profile_id,conversation_id,request_key,ciphertext,evidence_revision) VALUES($1,$2,$3,$4,$5,$6)',
            [
              id,
              input.profileId,
              input.conversationId,
              input.requestKey,
              encrypt(input.profileId, id, {
                question: input.question,
                answer: input.answer,
                code: input.code,
              }),
              input.evidenceRevision,
            ],
          );
        },
        input.profileId,
      ),
  };
}
export function createBudgetLedger(pool: Pool) {
  return {
    async reserve(amount: number) {
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 5_000_000)
        return null;
      return databaseTransaction(pool, async (c) => {
        const day = (
          await c.query(
            "SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS day",
          )
        ).rows[0].day;
        await c.query(
          'INSERT INTO ai_daily_budget(day) VALUES($1) ON CONFLICT DO NOTHING',
          [day],
        );
        const updated = await c.query(
          'UPDATE ai_daily_budget SET committed_microusd=committed_microusd+$2 WHERE day=$1 AND committed_microusd+$2<=5000000 RETURNING day',
          [day, amount],
        );
        if (!updated.rowCount) return null;
        const id = randomUUID();
        await c.query(
          'INSERT INTO ai_cost_reservations(id,day,reserved_microusd) VALUES($1,$2,$3)',
          [id, day, amount],
        );
        return id;
      });
    },
    async settle(id: string, actual: number) {
      return databaseTransaction(pool, async (c) => {
        const row = (
          await c.query(
            "SELECT day,reserved_microusd AS reserved FROM ai_cost_reservations WHERE id=$1 AND state='reserved' FOR UPDATE",
            [id],
          )
        ).rows[0];
        if (!row) return;
        if (
          !Number.isSafeInteger(actual) ||
          actual < 0 ||
          actual > Number(row.reserved)
        )
          return;
        await c.query(
          "UPDATE ai_cost_reservations SET actual_microusd=$2,state='settled' WHERE id=$1",
          [id, actual],
        );
        await c.query(
          'UPDATE ai_daily_budget SET committed_microusd=committed_microusd-$2 WHERE day=$1',
          [row.day, Number(row.reserved) - actual],
        );
      });
    },
  };
}
