import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { runMigrations } from '../../src/shared/database/migrator.js';

/**
 * Superuser URL of the Postgres used by tests. Defaults to the one started by
 * `pnpm db:up` (infra/compose/docker-compose.local.yml); CI overrides it.
 */
const ADMIN_URL =
  process.env['TEST_DATABASE_ADMIN_URL'] ?? 'postgres://postgres:postgres@127.0.0.1:5433/postgres';

// Same passwords as the local compose file. Test-only, not secrets.
const OWNER_PASSWORD = 'owner';
const APP_PASSWORD = 'app';

const bootstrapFile = (name: string): Promise<string> =>
  readFile(fileURLToPath(new URL(`../../../../infra/db/${name}`, import.meta.url)), 'utf8');

const withDatabase = (url: string, database: string): string => {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
};

const withCredentials = (url: string, user: string, password: string): string => {
  const parsed = new URL(url);
  parsed.username = user;
  parsed.password = password;
  return parsed.toString();
};

const runSql = async (url: string, sql: string): Promise<void> => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
};

export interface TestDatabase {
  /** az_app: what the API uses. RLS applies. */
  readonly appUrl: string;
  /** az_owner: owner of the tables. RLS does not apply (use only to arrange data). */
  readonly ownerUrl: string;
  readonly name: string;
  readonly drop: () => Promise<void>;
}

/**
 * Creates a brand-new database with the production bootstrap (infra/db) and every
 * migration applied. One per test file: tests never share state.
 */
export const createTestDatabase = async (): Promise<TestDatabase> => {
  const name = `az_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await runSql(ADMIN_URL, `CREATE DATABASE ${name}`);
  } catch (error) {
    throw new Error(
      `Test database unreachable. Start it with "pnpm db:up" (or set TEST_DATABASE_ADMIN_URL). Cause: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }

  const adminDbUrl = withDatabase(ADMIN_URL, name);
  await runSql(ADMIN_URL, await bootstrapFile('01-roles.sql'));
  await runSql(
    ADMIN_URL,
    `ALTER ROLE az_owner PASSWORD '${OWNER_PASSWORD}'; ALTER ROLE az_app PASSWORD '${APP_PASSWORD}';`,
  );
  await runSql(adminDbUrl, await bootstrapFile('02-database.sql'));

  const ownerUrl = withCredentials(adminDbUrl, 'az_owner', OWNER_PASSWORD);
  const appUrl = withCredentials(adminDbUrl, 'az_app', APP_PASSWORD);
  await runMigrations(ownerUrl);

  return {
    appUrl,
    ownerUrl,
    name,
    drop: async () => {
      await runSql(ADMIN_URL, `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    },
  };
};
