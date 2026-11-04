import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { login, refreshSession } from '../src/modules/identity/application/authentication.js';
import type { IdentityDeps } from '../src/modules/identity/application/identity-deps.js';
import { createOrganizationWithAdmin } from '../src/modules/identity/application/organization-setup.js';
import {
  confirmPasswordReset,
  requestPasswordReset,
} from '../src/modules/identity/application/password.js';
import {
  createUser,
  listUsers,
  updateUser,
} from '../src/modules/identity/application/user-management.js';
import { createIdentityDeps } from '../src/modules/identity/infrastructure/identity-deps.factory.js';
import { createDatabase } from '../src/shared/database/database.js';
import type { Database } from '../src/shared/database/database.js';
import { createTestDatabase } from './support/test-database.js';
import type { TestDatabase } from './support/test-database.js';

let testDb: TestDatabase | undefined;
let database: Database | undefined;
let deps: IdentityDeps;
const mail: { to: string; text: string }[] = [];

const tdb = (): TestDatabase => {
  if (!testDb) {
    throw new Error('test database was not created');
  }
  return testDb;
};

const asApp = async (sql: string, params: unknown[] = []): Promise<pg.QueryResult> => {
  const client = new pg.Client({ connectionString: tdb().appUrl });
  await client.connect();
  try {
    return await client.query(sql, params);
  } finally {
    await client.end();
  }
};

const PASSWORD = 'senha-do-admin-123';
let orgA = { organizationId: '', adminUserId: '' };
let orgB = { organizationId: '', adminUserId: '' };

beforeAll(async () => {
  testDb = await createTestDatabase();
  database = createDatabase({ url: testDb.appUrl, poolMax: 4 });
  deps = createIdentityDeps({
    database,
    jwtSecret: 'test-secret-with-at-least-32-characters!',
    panelUrl: 'https://painel.example.com',
    mailer: {
      send: (m) => {
        mail.push(m);
        return Promise.resolve();
      },
    },
  });
  const a = await createOrganizationWithAdmin(deps, {
    organizationName: 'Instituto A',
    slug: 'a',
    adminName: 'Admin A',
    adminEmail: 'admin@a.com',
    adminPassword: PASSWORD,
  });
  const b = await createOrganizationWithAdmin(deps, {
    organizationName: 'Instituto B',
    slug: 'b',
    adminName: 'Admin B',
    adminEmail: 'admin@b.com',
    adminPassword: PASSWORD,
  });
  if (!a.ok || !b.ok) {
    throw new Error('setup failed');
  }
  orgA = a.value;
  orgB = b.value;
}, 60_000);

afterAll(async () => {
  await database?.close();
  await testDb?.drop();
});

const actorA = () => ({
  ...orgA,
  userId: orgA.adminUserId,
  role: 'admin' as const,
  sessionId: 'x',
});

describe('identity on the real database (spec 005)', () => {
  it('logs in with Argon2 and issues a verifiable JWT', async () => {
    const result = await login(deps, { email: 'ADMIN@a.com', password: PASSWORD });

    expect(result.ok).toBe(true);
    const claims = result.ok ? await deps.accessTokens.verify(result.value.accessToken) : undefined;
    expect(claims).toEqual({
      userId: orgA.adminUserId,
      organizationId: orgA.organizationId,
      role: 'admin',
      sessionId: expect.any(String) as string,
    });
  });

  it('stores Argon2id hashes, never the password', async () => {
    const owner = new pg.Client({ connectionString: tdb().ownerUrl });
    await owner.connect();
    const { rows } = await owner.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      ['admin@a.com'],
    );
    await owner.end();

    expect(rows[0]?.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(rows[0]?.password_hash).not.toContain(PASSWORD);
  });

  it('rotation and reuse detection work with row locks on the real tables', async () => {
    const first = await login(deps, { email: 'admin@b.com', password: PASSWORD });
    const token = first.ok ? first.value.refreshToken : '';

    const [r1, r2] = await Promise.all([
      refreshSession(deps, { refreshToken: token }),
      refreshSession(deps, { refreshToken: token }),
    ]);

    // Concurrent use of one token: exactly one wins, the other is treated as reuse.
    expect([r1.ok, r2.ok].sort()).toEqual([false, true]);
    const winner = r1.ok ? r1.value : r2.ok ? r2.value : undefined;
    expect((await refreshSession(deps, { refreshToken: winner?.refreshToken ?? '' })).ok).toBe(
      false,
    );
  });

  it('password reset end to end with the e-mailed token', async () => {
    await requestPasswordReset(deps, { email: 'admin@a.com' });
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.at(-1)?.text ?? '')?.[1] ?? '';

    expect(await confirmPasswordReset(deps, { token, newPassword: 'nova-senha-segura-1' })).toEqual(
      {
        ok: true,
        value: undefined,
      },
    );
    expect((await login(deps, { email: 'admin@a.com', password: 'nova-senha-segura-1' })).ok).toBe(
      true,
    );
  });

  it('CA-08: user management never crosses organizations', async () => {
    await createUser(deps, actorA(), {
      name: 'Analista A',
      email: 'analista@a.com',
      role: 'analyst',
      password: 'senha-do-analista-1',
    });

    const list = await listUsers(deps, actorA());
    const touchB = await updateUser(deps, actorA(), orgB.adminUserId, { status: 'disabled' });

    expect(list.ok && list.value.map((u) => u.email).sort()).toEqual([
      'admin@a.com',
      'analista@a.com',
    ]);
    expect(touchB).toEqual({ ok: false, error: 'USER_NOT_FOUND' });
  });

  it('e-mail is unique across organizations at the database level too', async () => {
    const owner = new pg.Client({ connectionString: tdb().ownerUrl });
    await owner.connect();
    await expect(
      owner.query(
        `INSERT INTO users (id, organization_id, name, email, role, status, password_hash)
         VALUES (gen_random_uuid(), $1, 'Dup', 'admin@a.com', 'analyst', 'active', 'h')`,
        [orgB.organizationId],
      ),
    ).rejects.toThrow(/users_email_unique/);
    await owner.end();
  });

  it('the lookup functions return ids only and are the only cross-tenant read', async () => {
    const lookup = await asApp('SELECT * FROM auth_find_user_by_email($1)', ['admin@a.com']);
    const direct = await asApp('SELECT * FROM users');

    expect(lookup.fields.map((f) => f.name).sort()).toEqual(['organization_id', 'user_id']);
    expect(lookup.rows).toHaveLength(1);
    expect(direct.rows).toHaveLength(0);
  });

  it.each([
    ['UPDATE', 'UPDATE audit_logs SET action = $1', ['forged']],
    ['DELETE', 'DELETE FROM audit_logs WHERE action <> $1', ['x']],
    ['TRUNCATE', 'TRUNCATE audit_logs', []],
  ])('CA-10: the API database user cannot %s the audit log', async (_op, sql, params) => {
    await expect(asApp(sql, params)).rejects.toThrow(/permission denied/);
  });

  it('records the audit trail of the organization', async () => {
    const owner = new pg.Client({ connectionString: tdb().ownerUrl });
    await owner.connect();
    const { rows } = await owner.query<{ action: string }>(
      'SELECT action FROM audit_logs WHERE organization_id = $1 ORDER BY created_at',
      [orgA.organizationId],
    );
    await owner.end();

    const actions = rows.map((r) => r.action);
    for (const expected of [
      'organization.created',
      'user.created',
      'login.succeeded',
      'password.reset_requested',
      'password.reset_completed',
    ]) {
      expect(actions).toContain(expected);
    }
  });
});
