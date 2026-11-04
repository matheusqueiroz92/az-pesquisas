import { eq } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { organizations } from '../src/modules/identity/index.js';
import { createDatabase } from '../src/shared/database/database.js';
import type { Database } from '../src/shared/database/database.js';
import { newId } from '../src/shared/ids.js';
import { recordEvent } from '../src/shared/outbox/outbox.js';
import { outboxEvents } from '../src/shared/outbox/schema.js';
import { MissingTenantContextError, runWithTenant } from '../src/shared/tenancy/tenant-context.js';
import { createTestDatabase } from './support/test-database.js';
import type { TestDatabase } from './support/test-database.js';

/** Drizzle wraps driver errors; the Postgres message is in `cause`. */
const rejectionCause = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    return cause instanceof Error ? cause.message : String(error);
  }
  throw new Error('expected the operation to be rejected');
};

const ORG_A = newId();
const ORG_B = newId();

let testDb: TestDatabase | undefined;
/** The database created in beforeAll (undefined only if beforeAll itself failed). */
const tdb = (): TestDatabase => {
  if (!testDb) {
    throw new Error('test database was not created');
  }
  return testDb;
};

let db: Database | undefined;

const appDb = (): Database => {
  if (!db) {
    throw new Error('database was not created');
  }
  return db;
};

/** Arrange data as the table owner, bypassing RLS on purpose. */
const asOwner = async (sql: string, params: unknown[] = []): Promise<pg.QueryResult> => {
  const client = new pg.Client({ connectionString: tdb().ownerUrl });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
};

/** Raw az_app connection, with no tenant set: what a forgotten filter would look like. */
const asAppWithoutTenant = async (sql: string): Promise<pg.QueryResult> => {
  const client = new pg.Client({ connectionString: tdb().appUrl });
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
};

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = createDatabase({ url: tdb().appUrl, poolMax: 4 });

  await asOwner(
    `INSERT INTO organizations (id, name, slug) VALUES ($1, 'Instituto A', 'a'), ($2, 'Instituto B', 'b')`,
    [ORG_A, ORG_B],
  );
  await asOwner(
    `INSERT INTO outbox_events (id, organization_id, type, payload) VALUES
       ($1, $3, 'SurveyCreated', '{"n":1}'), ($2, $3, 'SurveyCreated', '{"n":2}'),
       ($4, $5, 'SurveyCreated', '{"n":3}')`,
    [newId(), newId(), ORG_A, newId(), ORG_B],
  );
}, 60_000);

afterAll(async () => {
  await db?.close();
  await testDb?.drop();
});

describe('tenant isolation in the database (spec 004)', () => {
  it('CA-02: a transaction of organization A sees only A rows', async () => {
    const rows = await runWithTenant(ORG_A, () =>
      appDb().withTenantTransaction((tx) => tx.select().from(outboxEvents)),
    );

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.organizationId === ORG_A)).toBe(true);
  });

  it('CA-02: organizations shows only the current organization', async () => {
    const rows = await runWithTenant(ORG_B, () =>
      appDb().withTenantTransaction((tx) => tx.select().from(organizations)),
    );

    expect(rows.map((r) => r.slug)).toEqual(['b']);
  });

  it('CA-03: inserting a row for another organization is refused by the database', async () => {
    const attempt = runWithTenant(ORG_A, () =>
      appDb().withTenantTransaction((tx) =>
        tx.insert(outboxEvents).values({
          id: newId(),
          organizationId: ORG_B,
          type: 'Forged',
          payload: {},
        }),
      ),
    );

    expect(await rejectionCause(attempt)).toMatch(/violates row-level security policy/);
  });

  it('CA-03: updating or deleting another organization rows affects nothing', async () => {
    const [updated, deleted] = await runWithTenant(ORG_A, () =>
      appDb().withTenantTransaction(async (tx) => [
        await tx
          .update(outboxEvents)
          .set({ type: 'Tampered' })
          .where(eq(outboxEvents.organizationId, ORG_B))
          .returning(),
        await tx.delete(organizations).where(eq(organizations.id, ORG_B)).returning(),
      ]),
    );

    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    const check = await asOwner(`SELECT type FROM outbox_events WHERE organization_id = $1`, [
      ORG_B,
    ]);
    expect(check.rows).toEqual([{ type: 'SurveyCreated' }]);
  });

  it('CA-03: moving a row of A to organization B is refused', async () => {
    const attempt = runWithTenant(ORG_A, () =>
      appDb().withTenantTransaction((tx) =>
        tx
          .update(outboxEvents)
          .set({ organizationId: ORG_B })
          .where(eq(outboxEvents.organizationId, ORG_A)),
      ),
    );

    expect(await rejectionCause(attempt)).toMatch(/violates row-level security policy/);
  });

  it('CA-04: without app.organization_id, az_app sees no rows at all', async () => {
    const events = await asAppWithoutTenant('SELECT * FROM outbox_events');
    const orgs = await asAppWithoutTenant('SELECT * FROM organizations');

    expect(events.rows).toHaveLength(0);
    expect(orgs.rows).toHaveLength(0);
  });

  it.each([
    ['disable RLS', 'ALTER TABLE outbox_events DISABLE ROW LEVEL SECURITY'],
    ['drop a policy', 'DROP POLICY tenant_isolation ON outbox_events'],
    ['drop a table', 'DROP TABLE outbox_events'],
    ['create a table', 'CREATE TABLE sneaky (id int)'],
    ['truncate a table', 'TRUNCATE outbox_events'],
    ['set the bypass flag', 'SET row_security = off; SELECT * FROM outbox_events'],
  ])('CA-05: az_app cannot %s', async (_case, sql) => {
    await expect(asAppWithoutTenant(sql)).rejects.toThrow();
  });

  it('CA-06: a business transaction outside a tenant scope fails before touching the database', async () => {
    await expect(
      appDb().withTenantTransaction((tx) => tx.select().from(outboxEvents)),
    ).rejects.toThrow(MissingTenantContextError);
  });

  it('the tenant setting does not leak to the next use of a pooled connection', async () => {
    const small = createDatabase({ url: tdb().appUrl, poolMax: 1 });
    try {
      await runWithTenant(ORG_A, () =>
        small.withTenantTransaction((tx) => tx.select().from(outboxEvents)),
      );
      const leaked = await small.withoutTenant((client) =>
        client.query<{ setting: string | null }>(
          `SELECT nullif(current_setting('app.organization_id', true), '') AS setting`,
        ),
      );
      expect(leaked.rows[0]?.setting ?? null).toBeNull();
    } finally {
      await small.close();
    }
  });

  it('rolls back everything when the business function fails', async () => {
    const before = await asOwner(`SELECT count(*)::int AS n FROM outbox_events`);

    await expect(
      runWithTenant(ORG_A, () =>
        appDb().withTenantTransaction(async (tx) => {
          await recordEvent(tx, { type: 'WillRollBack', payload: {} });
          throw new Error('business rule failed after writing');
        }),
      ),
    ).rejects.toThrow('business rule failed');

    const after = await asOwner(`SELECT count(*)::int AS n FROM outbox_events`);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('recordEvent stores the event for the current organization in the same transaction', async () => {
    const id = await runWithTenant(ORG_B, () =>
      appDb().withTenantTransaction((tx) =>
        recordEvent(tx, { type: 'DevicePaired', payload: { deviceId: 'd1' } }),
      ),
    );

    const row = await asOwner(
      `SELECT organization_id, type, payload, published_at FROM outbox_events WHERE id = $1`,
      [id],
    );
    expect(row.rows[0]).toEqual({
      organization_id: ORG_B,
      type: 'DevicePaired',
      payload: { deviceId: 'd1' },
      published_at: null,
    });
  });
});
