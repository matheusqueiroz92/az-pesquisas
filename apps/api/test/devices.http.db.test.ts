import { Writable } from 'node:stream';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.factory.js';
import { createOrganizationWithAdmin } from '../src/modules/identity/application/organization-setup.js';
import { createIdentityDeps } from '../src/modules/identity/infrastructure/identity-deps.factory.js';
import type { AppConfig } from '../src/shared/config/app-config.js';
import { createDatabase } from '../src/shared/database/database.js';
import type { Database } from '../src/shared/database/database.js';
import { createTestDatabase } from './support/test-database.js';
import type { TestDatabase } from './support/test-database.js';

/** Spec 016 over HTTP, against a real Postgres with RLS. */

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
const tokens: Record<string, string> = {};
let ipCounter = 0;

const freshIp = () => {
  ipCounter += 1;
  return `10.1.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
};

const api = () => {
  if (!app) {
    throw new Error('app was not created');
  }
  return app;
};

const call = (
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  options: { as?: string; body?: unknown; bearer?: string; ip?: string } = {},
) => {
  const token = options.as ? tokens[options.as] : options.bearer;
  return api().inject({
    method,
    url,
    headers: {
      'x-forwarded-for': options.ip ?? freshIp(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(options.body === undefined ? {} : { payload: options.body as Record<string, unknown> }),
  });
};

const login = async (email: string, password: string) => {
  const res = await call('POST', '/v1/auth/login', { body: { email, password } });
  expect(res.statusCode).toBe(200);
  return res.json<{ accessToken: string }>().accessToken;
};

const owner = async <T extends pg.QueryResultRow>(sql: string, params: unknown[] = []) => {
  if (!testDb) {
    throw new Error('test database was not created');
  }
  const client = new pg.Client({ connectionString: testDb.ownerUrl });
  await client.connect();
  try {
    return (await client.query<T>(sql, params)).rows;
  } finally {
    await client.end();
  }
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
    mailer: { send: () => Promise.resolve() },
  });

  tokens['adminA'] = await login('admin@a.com', PASSWORD);
  tokens['adminB'] = await login('admin@b.com', PASSWORD);
  for (const role of ['coordinator', 'analyst', 'client', 'interviewer']) {
    const created = await call('POST', '/v1/users', {
      as: 'adminA',
      body: { name: `Pessoa ${role}`, email: `${role}@a.com`, role, password: PASSWORD },
    });
    expect(created.statusCode).toBe(201);
    tokens[role] = await login(`${role}@a.com`, PASSWORD);
  }
}, 60_000);

afterAll(async () => {
  await app?.close();
  await seedDb?.close();
  await testDb?.drop();
});

const DEVICE = { platform: 'android', model: 'SM-X200', osVersion: '14', appVersion: '0.1.0' };
const BEAT = {
  appVersion: '0.2.0',
  batteryLevel: null,
  pendingInterviews: 0,
  pendingMediaBytes: 0,
  storageFreeBytes: null,
  lastSyncError: null,
};

const newCode = async (as = 'coordinator') => {
  const res = await call('POST', '/v1/devices/pairings', { as });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string; code: string; expiresAt: string }>();
};

const pair = async (as = 'coordinator') => {
  const { id, code } = await newCode(as);
  const res = await call('POST', '/v1/devices/pair', { body: { code, device: DEVICE } });
  expect(res.statusCode).toBe(201);
  return { pairingId: id, ...res.json<{ deviceId: string; deviceToken: string }>() };
};

describe('pairing (spec 016)', () => {
  it('CA-01: pairs with a fresh code, once, and stores only hashes', async () => {
    const { id, code } = await newCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(
      (await call('GET', `/v1/devices/pairings/${id}`, { as: 'coordinator' })).json(),
    ).toMatchObject({ status: 'pending', device: null });

    const res = await call('POST', '/v1/devices/pair', { body: { code, device: DEVICE } });
    expect(res.statusCode).toBe(201);
    const paired = res.json<{ deviceId: string; deviceToken: string }>();
    expect(res.json()).toMatchObject({ organization: { name: 'Instituto A' } });

    expect(
      (await call('GET', `/v1/devices/pairings/${id}`, { as: 'coordinator' })).json(),
    ).toMatchObject({ status: 'paired', device: { id: paired.deviceId, status: 'active' } });
    const again = await call('POST', '/v1/devices/pair', { body: { code, device: DEVICE } });
    expect(again.statusCode).toBe(422);
    expect(again.json()).toMatchObject({ code: 'PAIRING_CODE_INVALID' });

    const [row] = await owner<{ token_hash: string }>(
      'SELECT token_hash FROM devices WHERE id = $1',
      [paired.deviceId],
    );
    expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row?.token_hash).not.toContain(paired.deviceToken);
    const [pairingRow] = await owner<{ code_hash: string }>(
      'SELECT code_hash FROM device_pairings WHERE id = $1',
      [id],
    );
    expect(pairingRow?.code_hash).not.toBe(code);
  });

  it('CA-02: a wrong code and too many tries', async () => {
    const ip = '10.9.9.9';
    const wrong = await call('POST', '/v1/devices/pair', {
      ip,
      body: { code: '000000', device: DEVICE },
    });
    expect(wrong.statusCode).toBe(422);
    let last = wrong.statusCode;
    for (let i = 0; i < 12; i += 1) {
      last = (
        await call('POST', '/v1/devices/pair', { ip, body: { code: '000000', device: DEVICE } })
      ).statusCode;
    }
    expect(last).toBe(429);
  });
});

describe('devices (spec 016)', () => {
  it('CA-03, CA-04: heartbeat, rename, revoke', async () => {
    const { deviceId, deviceToken } = await pair();
    const beat = await call('POST', '/v1/device/heartbeat', { bearer: deviceToken, body: BEAT });
    expect(beat.statusCode).toBe(200);
    expect(beat.json()).toMatchObject({ policy: { deleteSyncedAfterDays: 30 } });
    expect(
      (await call('POST', '/v1/device/heartbeat', { bearer: 'x'.repeat(43), body: BEAT }))
        .statusCode,
    ).toBe(401);
    expect((await call('POST', '/v1/device/heartbeat', { body: BEAT })).statusCode).toBe(401);

    const renamed = await call('PATCH', `/v1/devices/${deviceId}`, {
      as: 'coordinator',
      body: { nickname: 'Tablet 03' },
    });
    expect(renamed.json()).toMatchObject({ nickname: 'Tablet 03', appVersion: '0.2.0' });

    const list = await call('GET', '/v1/devices', { as: 'adminA' });
    expect(list.json<{ items: { id: string }[] }>().items.map((d) => d.id)).toContain(deviceId);

    const revoked = await call('POST', `/v1/devices/${deviceId}/revoke`, { as: 'coordinator' });
    expect(revoked.json()).toMatchObject({ status: 'revoked' });
    const after = await call('POST', '/v1/device/heartbeat', { bearer: deviceToken, body: BEAT });
    expect(after.statusCode).toBe(401);
    expect(after.json()).toMatchObject({ code: 'DEVICE_TOKEN_INVALID' });
  });

  it('CA-05: survey team with devices and interviewers', async () => {
    const { deviceId } = await pair();
    const survey = await call('POST', '/v1/surveys', {
      as: 'coordinator',
      body: { title: 'Pesquisa com equipe', type: 'market' },
    });
    const surveyId = survey.json<{ id: string }>().id;
    const team = await call('GET', `/v1/surveys/${surveyId}/team`, { as: 'coordinator' });
    const view = team.json<{
      devices: { id: string; assigned: boolean }[];
      interviewers: { id: string; email: string }[];
    }>();
    const interviewer = view.interviewers.find((i) => i.email === 'interviewer@a.com');
    expect(interviewer).toBeDefined();
    expect(view.devices.find((d) => d.id === deviceId)).toMatchObject({ assigned: false });

    const saved = await call('PUT', `/v1/surveys/${surveyId}/team`, {
      as: 'coordinator',
      body: { deviceIds: [deviceId], interviewerIds: [interviewer?.id] },
    });
    expect(saved.statusCode).toBe(200);
    const savedView = saved.json<{ devices: { id: string; assigned: boolean }[] }>();
    expect(savedView.devices.find((d) => d.id === deviceId)).toMatchObject({ assigned: true });

    const coordinatorId = (
      await owner<{ id: string }>("SELECT id FROM users WHERE email = 'coordinator@a.com'")
    )[0]?.id;
    const notInterviewer = await call('PUT', `/v1/surveys/${surveyId}/team`, {
      as: 'coordinator',
      body: { deviceIds: [], interviewerIds: [coordinatorId] },
    });
    expect(notInterviewer.json()).toMatchObject({ code: 'INTERVIEWER_NOT_FOUND' });

    const devices = await call('GET', '/v1/devices', { as: 'coordinator' });
    expect(
      devices
        .json<{ items: { id: string; surveys: { id: string }[] }[] }>()
        .items.find((d) => d.id === deviceId)?.surveys,
    ).toEqual([expect.objectContaining({ id: surveyId })]);

    await call('POST', `/v1/devices/${deviceId}/revoke`, { as: 'coordinator' });
    const [left] = await owner<{ n: string }>(
      'SELECT count(*) AS n FROM survey_devices WHERE device_id = $1',
      [deviceId],
    );
    expect(left?.n).toBe('0');
  });

  it('CA-07: isolation and permissions', async () => {
    const { deviceId, pairingId } = await pair();
    expect(
      (await call('PATCH', `/v1/devices/${deviceId}`, { as: 'adminB', body: { nickname: 'Meu' } }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call('GET', `/v1/devices/pairings/${pairingId}`, { as: 'adminB' })).statusCode,
    ).toBe(404);
    expect(
      (await call('GET', '/v1/devices', { as: 'adminB' }))
        .json<{ items: { id: string }[] }>()
        .items.some((d) => d.id === deviceId),
    ).toBe(false);
    for (const role of ['analyst', 'client', 'interviewer']) {
      for (const [method, url] of [
        ['GET', '/v1/devices'],
        ['POST', '/v1/devices/pairings'],
        ['POST', `/v1/devices/${deviceId}/revoke`],
        ['GET', `/v1/surveys/${deviceId}/team`],
      ] as const) {
        expect((await call(method, url, { as: role })).statusCode, `${role} ${url}`).toBe(403);
      }
    }
  });

  it('the composite FK keeps a team inside one organization', async () => {
    const { deviceId } = await pair();
    const survey = await call('POST', '/v1/surveys', {
      as: 'adminB',
      body: { title: 'Pesquisa de B', type: 'market' },
    });
    const surveyOfB = survey.json<{ id: string }>().id;
    const [orgB] = await owner<{ id: string }>("SELECT id FROM organizations WHERE slug = 'b'");
    await expect(
      owner(
        `INSERT INTO survey_devices (organization_id, survey_id, device_id, assigned_at, assigned_by)
         VALUES ($1, $2, $3, now(), gen_random_uuid())`,
        [orgB?.id, surveyOfB, deviceId],
      ),
    ).rejects.toThrow(/survey_devices_device_fk/);
  });
});
