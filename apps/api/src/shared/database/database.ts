import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { currentOrganizationId } from '../tenancy/tenant-context.js';
import * as schema from './schema.js';

export type DrizzleDb = NodePgDatabase<typeof schema>;
/** The transaction handle every repository receives. */
export type Tx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

export interface Database {
  /**
   * Runs `fn` in a transaction bound to the organization of the current
   * TenantContext (barrier 1) and sets `app.organization_id` so RLS applies
   * (barrier 2). Throws MissingTenantContextError before touching the database
   * if there is no organization in context.
   */
  withTenantTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  /**
   * Raw connection with no organization set. Business tables return nothing here
   * (RLS); meant for health checks and infrastructure, never for use cases.
   */
  withoutTenant<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface DatabaseOptions {
  readonly url: string;
  readonly poolMax: number;
}

export const createDatabase = (options: DatabaseOptions): Database => {
  // The pool connects lazily: creating it does not require the database to be up.
  const pool = new pg.Pool({
    connectionString: options.url,
    max: options.poolMax,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    application_name: 'az-pesquisas-api',
  });
  const db = drizzle(pool, { schema });
  let closing: Promise<void> | undefined;

  return {
    withTenantTransaction: async <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => {
      // Read before opening the transaction: a missing tenant is a programming error.
      const organizationId = currentOrganizationId();
      return db.transaction(async (tx) => {
        // is_local = true: the setting dies with the transaction, so a pooled
        // connection never carries one organization into the next request.
        await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true)`);
        return fn(tx);
      });
    },

    withoutTenant: async <T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        return await fn(client);
      } finally {
        client.release();
      }
    },

    ping: async () => {
      await pool.query('select 1');
    },

    // Idempotent: Nest shutdown hooks and tests may both close it.
    close: () => (closing ??= pool.end()),
  };
};
