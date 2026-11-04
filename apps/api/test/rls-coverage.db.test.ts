import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase } from './support/test-database.js';
import type { TestDatabase } from './support/test-database.js';

/**
 * Guard for the most likely future mistake: a new business table without RLS.
 * Every table in `public` must have RLS enabled and at least one policy, except
 * the ones listed here with a reason.
 */
const TABLES_WITHOUT_RLS: Readonly<Record<string, string>> = {
  spatial_ref_sys: 'PostGIS reference data (coordinate systems), identical for every organization',
};

let testDb: TestDatabase | undefined;
/** The database created in beforeAll (undefined only if beforeAll itself failed). */
const tdb = (): TestDatabase => {
  if (!testDb) {
    throw new Error('test database was not created');
  }
  return testDb;
};

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 60_000);

afterAll(async () => {
  await testDb?.drop();
});

const query = async <T extends pg.QueryResultRow>(sql: string): Promise<T[]> => {
  const client = new pg.Client({ connectionString: tdb().ownerUrl });
  await client.connect();
  try {
    return (await client.query<T>(sql)).rows;
  } finally {
    await client.end();
  }
};

describe('RLS coverage (spec 004)', () => {
  it('every table in public has RLS enabled and a policy', async () => {
    const tables = await query<{ table: string; rls: boolean; policies: number }>(`
      SELECT c.relname AS table,
             c.relrowsecurity AS rls,
             (SELECT count(*)::int FROM pg_policies p
               WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
       ORDER BY c.relname`);

    const unprotected = tables
      .filter((t) => !(t.table in TABLES_WITHOUT_RLS))
      .filter((t) => !t.rls || t.policies === 0)
      .map((t) => t.table);

    expect(tables.length).toBeGreaterThan(0);
    expect(unprotected, 'tables without RLS or without a policy').toEqual([]);
  });

  it('every table with organization_id references organizations', async () => {
    const missing = await query<{ table: string }>(`
      SELECT c.table_name AS table
        FROM information_schema.columns c
       WHERE c.table_schema = 'public' AND c.column_name = 'organization_id'
         AND NOT EXISTS (
           SELECT 1 FROM information_schema.table_constraints tc
             JOIN information_schema.key_column_usage k
               ON k.constraint_name = tc.constraint_name AND k.table_name = tc.table_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = c.table_name AND k.column_name = 'organization_id')`);

    expect(missing.map((m) => m.table)).toEqual([]);
  });

  it('az_app owns nothing and cannot read the migration journal', async () => {
    const owned = await query<{ name: string }>(`
      SELECT c.relname AS name FROM pg_class c
        JOIN pg_roles r ON r.oid = c.relowner
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE r.rolname = 'az_app' AND n.nspname IN ('public', 'drizzle')`);
    const [journal] = await query<{ usage: boolean }>(
      `SELECT has_schema_privilege('az_app', 'drizzle', 'USAGE') AS usage`,
    );

    expect(owned).toEqual([]);
    expect(journal?.usage).toBe(false);
  });
});
