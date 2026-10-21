import { createHash, randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Pool, PoolClient } from 'pg';
import {
  databaseTransaction,
  bindTransactionProfile,
} from '../../../../infrastructure/db/transaction.js';
import type {
  Invitation,
  InvitationDelivery,
  Profile,
  ProfileStore,
  ProfileTransaction,
} from '../contracts/profiles.js';

export const invitationTokens = {
  create: () => randomBytes(32).toString('hex'),
  hash: (token: string) => createHash('sha256').update(token).digest('hex'),
};
export function createLocalInvitationDelivery(
  directory: string,
): InvitationDelivery {
  return {
    async deliver(input) {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 });
      await fs.writeFile(
        path.join(directory, `${randomUUID()}.json`),
        JSON.stringify({ ...input, delivery: 'local-capture-only' }),
        { flag: 'wx', mode: 0o600 },
      );
    },
  };
}
const profileColumns =
  'id, owner_id AS "ownerId", display_name AS "displayName", kind';
function transactionAdapter(client: PoolClient): ProfileTransaction {
  return {
    async createProfile(actorId, input) {
      return (
        (
          await client.query<Profile>(
            `INSERT INTO identity_profile(owner_id, display_name,kind,contact_email) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING ${profileColumns}`,
            [
              actorId,
              input.displayName,
              input.kind,
              input.contactEmail ?? null,
            ],
          )
        ).rows[0] ?? null
      );
    },
    async lockContext(actor) {
      const session = await client.query(
        'SELECT s.id FROM identity_session s JOIN identity_user u ON u.id=s."userId" WHERE s.id=$1 AND s."userId"=$2 AND s."expiresAt">clock_timestamp() AND u."emailVerified"=true FOR UPDATE OF s',
        [actor.sessionId, actor.id],
      );
      if (session.rowCount !== 1) return null;
      await client.query(
        'INSERT INTO identity_profile_context(session_id) VALUES($1) ON CONFLICT DO NOTHING',
        [actor.sessionId],
      );
      return (
        await client.query(
          'SELECT profile_id AS "profileId", revision FROM identity_profile_context WHERE session_id=$1 FOR UPDATE',
          [actor.sessionId],
        )
      ).rows[0];
    },
    async selectProfile(sessionId, profileId) {
      return (
        await client.query(
          'UPDATE identity_profile_context SET profile_id=$2,revision=revision+1,changed_at=clock_timestamp() WHERE session_id=$1 RETURNING revision',
          [sessionId, profileId],
        )
      ).rows[0].revision as number;
    },
    async contact(id) {
      return (
        await client.query(
          'SELECT contact_email FROM identity_profile WHERE id=$1',
          [id],
        )
      ).rows[0].contact_email as string | null;
    },
    async setContact(id, email) {
      await client.query(
        'UPDATE identity_profile SET contact_email=$2 WHERE id=$1',
        [id, email],
      );
    },
    async lockProfile(id) {
      await bindTransactionProfile(client, id);
      return (
        (
          await client.query<Profile>(
            `SELECT ${profileColumns} FROM identity_profile WHERE id=$1 FOR NO KEY UPDATE`,
            [id],
          )
        ).rows[0] ?? null
      );
    },
    async consent(id, purpose) {
      return (
        (
          await client.query(
            'SELECT granted FROM identity_consent WHERE profile_id=$1 AND purpose=$2 ORDER BY sequence DESC LIMIT 1',
            [id, purpose],
          )
        ).rows[0]?.granted === true
      );
    },
    async recordConsent(id, actorId, input) {
      await client.query(
        'INSERT INTO identity_consent(profile_id,actor_id,purpose,notice_version,granted) VALUES($1,$2,$3,$4,$5)',
        [id, actorId, input.purpose, input.noticeVersion, input.granted],
      );
    },
    async hasGrant(id, actorId, scope) {
      return (
        (
          await client.query(
            'SELECT 1 FROM identity_profile_grant WHERE profile_id=$1 AND account_id=$2 AND revoked_at IS NULL AND expires_at > clock_timestamp() AND scopes @> $3::jsonb LIMIT 1',
            [id, actorId, JSON.stringify([scope])],
          )
        ).rowCount === 1
      );
    },
    async createInvitation(id, input, hash, expiry) {
      return (
        await client.query(
          'INSERT INTO identity_profile_invitation(profile_id,email,role,scopes,token_hash,expires_at,grant_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
          [
            id,
            input.email,
            input.role,
            JSON.stringify(input.scopes),
            hash,
            expiry,
            input.expiresAt,
          ],
        )
      ).rows[0].id as string;
    },
    async invitation(hash) {
      return (
        (
          await client.query<Invitation>(
            'SELECT id, profile_id AS "profileId", email, role, scopes, expires_at AS "expiresAt", grant_expires_at AS "grantExpiresAt", accepted_at AS "acceptedAt", revoked_at AS "revokedAt" FROM identity_profile_invitation WHERE token_hash=$1',
            [hash],
          )
        ).rows[0] ?? null
      );
    },
    async acceptInvitation(invitation, actorId) {
      await client.query(
        'UPDATE identity_profile_invitation SET accepted_at=clock_timestamp() WHERE id=$1',
        [invitation.id],
      );
      return (
        await client.query(
          'INSERT INTO identity_profile_grant(invitation_id,profile_id,account_id,role,scopes,expires_at) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
          [
            invitation.id,
            invitation.profileId,
            actorId,
            invitation.role,
            JSON.stringify(invitation.scopes),
            invitation.grantExpiresAt,
          ],
        )
      ).rows[0].id as string;
    },
    async revoke(id, resourceId) {
      const invites = await client.query(
        'UPDATE identity_profile_invitation SET revoked_at=clock_timestamp() WHERE profile_id=$1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id=$2 OR id IN (SELECT invitation_id FROM identity_profile_grant WHERE id=$2 AND profile_id=$1))',
        [id, resourceId ?? null],
      );
      const grants = await client.query(
        'UPDATE identity_profile_grant SET revoked_at=clock_timestamp() WHERE profile_id=$1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id=$2 OR invitation_id=$2)',
        [id, resourceId ?? null],
      );
      return (invites.rowCount ?? 0) + (grants.rowCount ?? 0) > 0;
    },
    async audit(id, actorId, event, resourceId, purpose) {
      await client.query(
        'INSERT INTO identity_profile_audit(profile_id,actor_id,event,resource_id,purpose) VALUES($1,$2,$3,$4,$5)',
        [id, actorId, event, resourceId ?? null, purpose ?? null],
      );
    },
    async consentHistory(id) {
      return (
        await client.query(
          'SELECT sequence::text, purpose, notice_version AS "noticeVersion", granted, recorded_at AS "recordedAt" FROM identity_consent WHERE profile_id=$1 ORDER BY sequence DESC LIMIT 100',
          [id],
        )
      ).rows;
    },
    async auditHistory(id) {
      return (
        await client.query(
          'SELECT sequence::text, actor_id AS "actorId", event, resource_id AS "resourceId", purpose, recorded_at AS "recordedAt" FROM identity_profile_audit WHERE profile_id=$1 ORDER BY sequence DESC LIMIT 100',
          [id],
        )
      ).rows;
    },
    async sharingHistory(id) {
      return (
        await client.query(
          'SELECT i.id AS "invitationId", g.id AS "grantId", i.email, i.role, i.scopes, i.expires_at AS "invitationExpiresAt", i.grant_expires_at AS "grantExpiresAt", i.accepted_at AS "acceptedAt", i.revoked_at AS "invitationRevokedAt", g.revoked_at AS "grantRevokedAt" FROM identity_profile_invitation i LEFT JOIN identity_profile_grant g ON g.invitation_id=i.id WHERE i.profile_id=$1 ORDER BY i.created_at DESC LIMIT 100',
          [id],
        )
      ).rows;
    },
  };
}
export function createProfileStore(pool: Pool): ProfileStore {
  return {
    async transaction(work) {
      return databaseTransaction(pool, (client) =>
        work(transactionAdapter(client)),
      );
    },
    async candidateProfiles(actorId) {
      return (
        await pool.query(
          'SELECT id FROM identity_profile WHERE owner_id=$1 UNION SELECT profile_id AS id FROM identity_profile_grant WHERE account_id=$1 AND revoked_at IS NULL AND expires_at>clock_timestamp() LIMIT 100',
          [actorId],
        )
      ).rows.map((row) => row.id as string);
    },
    async ready() {
      for (const table of [
        'identity_profile',
        'identity_consent',
        'identity_profile_invitation',
        'identity_profile_grant',
        'identity_profile_audit',
        'identity_profile_context',
      ])
        await pool.query(`SELECT 1 FROM ${table} LIMIT 0`);
      await pool.query(
        'SELECT kind, contact_email FROM identity_profile LIMIT 0',
      );
    },
  };
}
