import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient } from 'pg';

interface Transaction {
  pool: Pool;
  client: PoolClient;
  profileId: string | null;
  active: boolean;
  rollbackOnly: boolean;
}
const current = new AsyncLocalStorage<Transaction>();
export async function bindTransactionProfile(
  client: PoolClient,
  profileId: string,
) {
  const context = current.getStore();
  if (!context || !context.active || context.client !== client)
    throw new Error('No active transaction');
  if (context.profileId !== null && context.profileId !== profileId)
    throw new Error('Transaction profile mismatch');
  if (context.profileId === null) {
    await client.query("SELECT set_config('biovitai.profile_id',$1,true)", [
      profileId,
    ]);
    context.profileId = profileId;
  }
}
// Infrastructure-only unit of work. Nested adapters share the current pool/client,
// commit with the authorization audit, and cannot accidentally switch profiles.
export async function databaseTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
  profileId?: string,
): Promise<T> {
  const parent = current.getStore();
  if (parent?.pool === pool) {
    if (!parent.active) throw new Error('Transaction has finished');
    try {
      if (profileId) await bindTransactionProfile(parent.client, profileId);
      return await work(parent.client);
    } catch (error) {
      parent.rollbackOnly = true;
      throw error;
    }
  }
  if (parent?.profileId && profileId && parent.profileId !== profileId)
    throw new Error('Transaction profile mismatch');
  const client = await pool.connect();
  const context: Transaction = {
    pool,
    client,
    profileId: null,
    active: true,
    rollbackOnly: false,
  };
  try {
    await client.query('BEGIN');
    return await current.run(context, async () => {
      if (profileId) await bindTransactionProfile(client, profileId);
      const result = await work(client);
      if (context.rollbackOnly) throw new Error('Transaction was rolled back');
      await client.query('COMMIT');
      return result;
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    context.active = false;
    client.release();
  }
}
