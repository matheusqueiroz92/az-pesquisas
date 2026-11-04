import { Writable } from 'node:stream';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory.js';
import { createOrganizationWithAdmin } from '../src/modules/identity/application/organization-setup.js';
import { createIdentityDeps } from '../src/modules/identity/infrastructure/identity-deps.factory.js';
import type { AppConfig } from '../src/shared/config/app-config.js';
import { createDatabase } from '../src/shared/database/database.js';
import type { Database } from '../src/shared/database/database.js';
import { createTestDatabase } from './support/test-database.js';
import type { TestDatabase } from './support/test-database.js';

const SECRET = 'test-secret-with-at-least-32-characters!';
const PASSWORD = 'senha-do-admin-123';
const silent = new Writable({
  write: (_chunk, _encoding, done) => {
    done();
  },
});

let testDb: TestDatabase | undefined;
let seedDb: Database | undefined;
let app: NestFastifyApplication | undefined;
const mail: { to: string; text: string }[] = [];
let ipCounter = 0;

/** Each call comes from a different client IP, so rate limits do not leak between tests. */
const freshIp = () => {
  ipCounter += 1;
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

const api = () => {
  if (!app) {
    throw new Error('app was not created');
  }
  return app;
};

const call = (
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  options: { token?: string; body?: unknown; ip?: string } = {},
) =>
  api().inject({
    method,
    url,
    headers: {
      'x-forwarded-for': options.ip ?? freshIp(),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body === undefined ? {} : { payload: options.body as Record<string, unknown> }),
  });

const loginAs = async (email: string, password = PASSWORD) => {
  const res = await call('POST', '/v1/auth/login', { body: { email, password } });
  expect(res.statusCode).toBe(200);
  return res.json<{ accessToken: string; refreshToken: string; user: { id: string } }>();
};

beforeAll(async () => {
  testDb = await createTestDatabase();
  seedDb = createDatabase({ url: testDb.appUrl, poolMax: 2 });
  const seedDeps = createIdentityDeps({
    database: seedDb,
    jwtSecret: SECRET,
    panelUrl: 'https://painel.example.com',
    mailer: { send: () => Promise.resolve() },
  });
  for (const slug of ['a', 'b']) {
    await createOrganizationWithAdmin(seedDeps, {
      organizationName: `Instituto ${slug.toUpperCase()}`,
      slug,
      adminName: `Admin ${slug.toUpperCase()}`,
      adminEmail: `admin@${slug}.com`,
      adminPassword: PASSWORD,
    });
  }

  const config: AppConfig = {
    nodeEnv: 'test',
    appEnv: 'local',
    appVersion: 'test',
    host: '127.0.0.1',
    port: 0,
    logLevel: 'info',
    corsOrigins: [],
    sentryDsn: undefined,
    databaseUrl: testDb.appUrl,
    databasePoolMax: 4,
    jwtSecret: SECRET,
    panelUrl: 'https://painel.example.com',
    mailDir: '.mail-test',
  };
  app = await createApp(config, {
    logDestination: silent,
    mailer: {
      send: (m) => {
        mail.push(m);
        return Promise.resolve();
      },
    },
  });
}, 60_000);

afterAll(async () => {
  await app?.close();
  await seedDb?.close();
  await testDb?.drop();
});

describe('authentication over HTTP (spec 005)', () => {
  it('CA-01: login returns tokens and /me returns the user', async () => {
    const tokens = await loginAs('Admin@A.com');

    const me = await call('GET', '/v1/auth/me', { token: tokens.accessToken });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ email: 'admin@a.com', role: 'admin', name: 'Admin A' });
  });

  it('CA-02: wrong password and unknown e-mail get the same 401', async () => {
    const wrong = await call('POST', '/v1/auth/login', {
      body: { email: 'admin@a.com', password: 'errada' },
    });
    const unknown = await call('POST', '/v1/auth/login', {
      body: { email: 'ninguem@a.com', password: 'errada' },
    });

    expect([wrong.statusCode, unknown.statusCode]).toEqual([401, 401]);
    expect(wrong.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(unknown.json<{ detail: string }>().detail).toBe(wrong.json<{ detail: string }>().detail);
  });

  it('CA-04: refresh rotates and reuse kills the session', async () => {
    const tokens = await loginAs('admin@b.com');

    const first = await call('POST', '/v1/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });
    const reuse = await call('POST', '/v1/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });
    const legit = await call('POST', '/v1/auth/refresh', {
      body: { refreshToken: first.json<{ refreshToken: string }>().refreshToken },
    });

    expect(first.statusCode).toBe(200);
    expect(reuse.statusCode).toBe(401);
    expect(legit.statusCode).toBe(401);
    expect(legit.json()).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
  });

  it('CA-05: logout returns 204 and the refresh token stops working', async () => {
    const tokens = await loginAs('admin@b.com');

    const out = await call('POST', '/v1/auth/logout', {
      body: { refreshToken: tokens.refreshToken },
    });
    const after = await call('POST', '/v1/auth/refresh', {
      body: { refreshToken: tokens.refreshToken },
    });

    expect(out.statusCode).toBe(204);
    expect(after.statusCode).toBe(401);
  });

  it('CA-06: password reset answers 202 for any e-mail and the link works once', async () => {
    const unknown = await call('POST', '/v1/auth/password-reset', {
      body: { email: 'ninguem@x.com' },
    });
    const known = await call('POST', '/v1/auth/password-reset', { body: { email: 'admin@b.com' } });
    const token = /token=([A-Za-z0-9_-]+)/.exec(mail.at(-1)?.text ?? '')?.[1] ?? '';

    const confirm = await call('POST', '/v1/auth/password-reset/confirm', {
      body: { token, newPassword: 'nova-senha-do-b-1' },
    });
    const again = await call('POST', '/v1/auth/password-reset/confirm', {
      body: { token, newPassword: 'outra-senha-do-b-2' },
    });

    expect([unknown.statusCode, known.statusCode]).toEqual([202, 202]);
    expect(confirm.statusCode).toBe(204);
    expect(again.statusCode).toBe(400);
    expect(again.json()).toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    expect((await loginAs('admin@b.com', 'nova-senha-do-b-1')).accessToken).toBeTruthy();
  });

  it('changes the own password with the current one', async () => {
    const tokens = await loginAs('admin@a.com');

    const wrong = await call('POST', '/v1/auth/password', {
      token: tokens.accessToken,
      body: { currentPassword: 'errada', newPassword: 'nova-senha-do-a-1' },
    });

    expect(wrong.statusCode).toBe(400);
    expect(wrong.json()).toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
  });

  it('rate-limits login to 10 per minute per IP', async () => {
    const ip = '10.99.99.99';
    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await call('POST', '/v1/auth/login', {
        ip,
        body: { email: `ninguem${i}@a.com`, password: 'x' },
      });
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});

describe('access control over HTTP (spec 005)', () => {
  it('CA-07: no token or a forged token is 401 UNAUTHENTICATED', async () => {
    const none = await call('GET', '/v1/users');
    const forged = await call('GET', '/v1/users', { token: 'eyJhbGciOiJub25lIn0.e30.' });

    expect([none.statusCode, forged.statusCode]).toEqual([401, 401]);
    expect(none.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('CA-07: non-admin roles get 403 FORBIDDEN on user management', async () => {
    const admin = await loginAs('admin@a.com');
    const created = await call('POST', '/v1/users', {
      token: admin.accessToken,
      body: {
        name: 'Coordenadora A',
        email: 'coord@a.com',
        role: 'coordinator',
        password: 'senha-da-coord-1',
      },
    });
    const coord = await loginAs('coord@a.com', 'senha-da-coord-1');

    const list = await call('GET', '/v1/users', { token: coord.accessToken });

    expect(created.statusCode).toBe(201);
    expect(list.statusCode).toBe(403);
    expect(list.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('CA-08: admin of A only sees A, and B users are 404', async () => {
    const adminA = await loginAs('admin@a.com');
    const adminB = await loginAs('admin@b.com', 'nova-senha-do-b-1');

    const listA = await call('GET', '/v1/users', { token: adminA.accessToken });
    const getB = await call('GET', `/v1/users/${adminB.user.id}`, { token: adminA.accessToken });
    const patchB = await call('PATCH', `/v1/users/${adminB.user.id}`, {
      token: adminA.accessToken,
      body: { status: 'disabled' },
    });

    const emails = listA.json<{ items: { email: string }[] }>().items.map((u) => u.email);
    expect(emails.every((e) => e.endsWith('@a.com'))).toBe(true);
    expect([getB.statusCode, patchB.statusCode]).toEqual([404, 404]);
  });

  it('CA-08: an organizationId sent in the body is refused, not used', async () => {
    const adminA = await loginAs('admin@a.com');
    const adminB = await loginAs('admin@b.com', 'nova-senha-do-b-1');

    const res = await call('POST', '/v1/users', {
      token: adminA.accessToken,
      body: {
        name: 'Infiltrado',
        email: 'infiltrado@x.com',
        role: 'admin',
        password: 'senha-do-infiltrado',
        organizationId: adminB.user.id,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'organizationId', code: 'unrecognized_keys' }],
    });
  });

  it('CA-09: invalid bodies list the fields without echoing values', async () => {
    const admin = await loginAs('admin@a.com');

    const res = await call('POST', '/v1/users', {
      token: admin.accessToken,
      body: { name: 'X', email: 'nao-e-email', role: 'chefe', password: 'curta' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<{ code: string; errors: { field: string }[] }>();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.errors.map((e) => e.field).sort()).toEqual(['email', 'name', 'password', 'role']);
    expect(res.body).not.toContain('nao-e-email');
    expect(res.body).not.toContain('curta');
  });

  it('an admin cannot disable themself over HTTP (409)', async () => {
    const admin = await loginAs('admin@a.com');

    const res = await call('PATCH', `/v1/users/${admin.user.id}`, {
      token: admin.accessToken,
      body: { status: 'disabled' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'CANNOT_DISABLE_SELF' });
  });

  it('health stays public', async () => {
    expect((await call('GET', '/health/live')).statusCode).toBe(200);
  });
});
