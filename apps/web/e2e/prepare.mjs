// `pnpm test:e2e` step 1: a disposable database with the production bootstrap,
// migrations applied by the real `db:migrate` and admins created by the real
// `seed:admin` (design 007).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import {
  ADMIN_URL,
  APP_PASSWORD,
  DATABASE,
  DATABASE_ADMIN_URL,
  DATABASE_APP_URL,
  DATABASE_OWNER_URL,
  JWT_SECRET,
  MAIL_DIR,
  ORGS,
  OWNER_PASSWORD,
} from './settings.mjs';

const BOOTSTRAP_LOCK = 4_242_005; // same lock as apps/api/test/support/test-database.ts

const sql = async (url, text) => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(text);
  } finally {
    await client.end();
  }
};

const bootstrapFile = (name) =>
  readFile(fileURLToPath(new URL(`../../../infra/db/${name}`, import.meta.url)), 'utf8');

const run = (args, env) => {
  const result = spawnSync('pnpm', ['--filter', '@az-pesquisas/api', ...args], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed`);
  }
};

if (!existsSync(fileURLToPath(new URL('../.next/BUILD_ID', import.meta.url)))) {
  throw new Error('Panel not built. Run "pnpm --filter @az-pesquisas/web build" first.');
}

try {
  await sql(ADMIN_URL, `DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
  await sql(ADMIN_URL, `CREATE DATABASE ${DATABASE}`);
} catch (error) {
  throw new Error('Database unreachable. Start it with "pnpm db:up".', { cause: error });
}
await sql(
  ADMIN_URL,
  `BEGIN;
   SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK});
   ${await bootstrapFile('01-roles.sql')}
   ALTER ROLE az_owner PASSWORD '${OWNER_PASSWORD}';
   ALTER ROLE az_app PASSWORD '${APP_PASSWORD}';
   COMMIT;`,
);
await sql(DATABASE_ADMIN_URL, await bootstrapFile('02-database.sql'));

run(['db:migrate'], { DATABASE_MIGRATION_URL: DATABASE_OWNER_URL });

await rm(MAIL_DIR, { recursive: true, force: true });
for (const org of ORGS) {
  run(['seed:admin'], {
    DATABASE_URL: DATABASE_APP_URL,
    JWT_SECRET,
    MAIL_DIR,
    SEED_ORG_NAME: org.name,
    SEED_ORG_SLUG: org.slug,
    SEED_ADMIN_NAME: org.adminName,
    SEED_ADMIN_EMAIL: org.adminEmail,
    SEED_ADMIN_PASSWORD: org.adminPassword,
  });
}
process.stdout.write(`E2E database "${DATABASE}" ready.\n`);
