import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Writable } from 'node:stream';

import pg from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory.js';
import type { AppConfig } from '../src/shared/config/app-config.js';
import { createTestDatabase } from './support/test-database.js';
import type { TestDatabase } from './support/test-database.js';

let testDb: TestDatabase | undefined;
/** The database created in beforeAll (undefined only if beforeAll itself failed). */
const tdb = (): TestDatabase => {
  if (!testDb) {
    throw new Error('test database was not created');
  }
  return testDb;
};

let app: NestFastifyApplication | undefined;

const silent = new Writable({
  write: (_chunk, _encoding, done) => {
    done();
  },
});

const config = (databaseUrl: string): AppConfig => ({
  nodeEnv: 'test',
  appEnv: 'local',
  appVersion: 'test',
  host: '127.0.0.1',
  port: 0,
  logLevel: 'info',
  corsOrigins: [],
  sentryDsn: undefined,
  databaseUrl,
  databasePoolMax: 2,
});

beforeAll(async () => {
  testDb = await createTestDatabase();
}, 60_000);

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  await testDb?.drop();
});

describe('readiness with the database (spec 004, CA-07)', () => {
  it('reports database up when Postgres answers', async () => {
    app = await createApp(config(tdb().appUrl), { logDestination: silent });

    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('reports database down with 503 when Postgres is unreachable, without leaking the URL', async () => {
    app = await createApp(config('postgres://az_app:s3cr3t@127.0.0.1:1/az_pesquisas'), {
      logDestination: silent,
    });

    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable', checks: { database: 'down' } });
    expect(res.body).not.toContain('s3cr3t');
  });

  it('closes the connection pool when the app shuts down', async () => {
    const appConnections = async (): Promise<number> => {
      const client = new pg.Client({ connectionString: tdb().ownerUrl });
      await client.connect();
      try {
        const res = await client.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE datname = $1 AND usename = 'az_app'`,
          [tdb().name],
        );
        return res.rows[0]?.n ?? 0;
      } finally {
        await client.end();
      }
    };

    app = await createApp(config(tdb().appUrl), { logDestination: silent });
    await app.inject({ method: 'GET', url: '/health/ready' });
    const open = await appConnections();

    await app.close();
    app = undefined;

    expect(open).toBeGreaterThan(0);
    await expect.poll(appConnections, { timeout: 2_000 }).toBe(0);
  });
});
