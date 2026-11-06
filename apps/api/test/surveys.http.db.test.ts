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

/** Spec 013 over HTTP, against a real Postgres with RLS. */

const SECRET = 'test-secret-with-at-least-32-characters!';
const PASSWORD = 'senha-do-admin-123';
const ITAPETINGA = 2916401;
const ITAMBE = 2915809;
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
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  options: { as?: string; body?: unknown } = {},
) => {
  const token = options.as ? tokens[options.as] : undefined;
  return api().inject({
    method,
    url,
    headers: {
      'x-forwarded-for': freshIp(),
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

const SURVEY = {
  title: 'Avaliação da gestão municipal de Itapetinga',
  type: 'municipal_evaluation',
  municipalityCodes: [ITAPETINGA, ITAMBE],
  fieldStart: '2026-11-10',
  fieldEnd: '2026-11-20',
  targetInterviews: 600,
  settings: { gps: 'required' },
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

describe('clients (spec 013)', () => {
  it('CA-01 and CA-03: create, edit, list with counts, refuse delete while in use', async () => {
    const created = await call('POST', '/v1/clients', {
      as: 'coordinator',
      body: { name: 'Prefeitura de Itapetinga', document: '11.222.333/0001-81' },
    });
    expect(created.statusCode).toBe(201);
    const client = created.json<{ id: string; document: string }>();
    expect(client.document).toBe('11222333000181');

    const edited = await call('PATCH', `/v1/clients/${client.id}`, {
      as: 'coordinator',
      body: { contactName: 'Ana', contactEmail: 'Ana@Itapetinga.BA.gov.br' },
    });
    expect(edited.json()).toMatchObject({
      contactName: 'Ana',
      contactEmail: 'ana@itapetinga.ba.gov.br',
    });

    const survey = await call('POST', '/v1/surveys', {
      as: 'coordinator',
      body: { ...SURVEY, clientId: client.id },
    });
    expect(survey.statusCode).toBe(201);

    const list = await call('GET', '/v1/clients', { as: 'coordinator' });
    expect(list.json()).toMatchObject({
      items: [{ id: client.id, name: 'Prefeitura de Itapetinga', surveyCount: 1 }],
    });

    const refused = await call('DELETE', `/v1/clients/${client.id}`, { as: 'adminA' });
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'CLIENT_IN_USE' });
  });

  it('CA-02: an invalid CNPJ is refused pointing at the field', async () => {
    const res = await call('POST', '/v1/clients', {
      as: 'coordinator',
      body: { name: 'Cliente', document: '11.222.333/0001-82' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [expect.objectContaining({ field: 'document' })],
    });
  });

  it('CA-03: a client without surveys is deleted', async () => {
    const created = await call('POST', '/v1/clients', { as: 'adminA', body: { name: 'Avulso' } });
    const { id } = created.json<{ id: string }>();
    expect((await call('DELETE', `/v1/clients/${id}`, { as: 'adminA' })).statusCode).toBe(204);
    expect((await call('GET', `/v1/clients/${id}`, { as: 'adminA' })).statusCode).toBe(404);
  });
});

describe('surveys (spec 013)', () => {
  it('CA-04, CA-07 and CA-08: create, archive, unarchive, duplicate, delete', async () => {
    const created = await call('POST', '/v1/surveys', { as: 'coordinator', body: SURVEY });
    expect(created.statusCode).toBe(201);
    const survey = created.json<{ id: string }>();
    expect(created.json()).toMatchObject({
      status: 'draft',
      municipalityCodes: [ITAPETINGA, ITAMBE],
      settings: { gps: 'required', audio: 'off', minDurationSec: 0, consentText: null },
      tse: null,
      clientName: null,
    });

    const archived = await call('POST', `/v1/surveys/${survey.id}/archive`, { as: 'coordinator' });
    expect(archived.statusCode).toBe(200);
    expect(archived.json()).toMatchObject({ status: 'archived' });

    const editArchived = await call('PATCH', `/v1/surveys/${survey.id}`, {
      as: 'coordinator',
      body: { targetInterviews: 10 },
    });
    expect(editArchived.statusCode).toBe(409);
    expect(editArchived.json()).toMatchObject({ code: 'SURVEY_NOT_EDITABLE' });
    expect(
      (await call('DELETE', `/v1/surveys/${survey.id}`, { as: 'coordinator' })).statusCode,
    ).toBe(409);

    const copy = await call('POST', `/v1/surveys/${survey.id}/duplicate`, { as: 'coordinator' });
    expect(copy.statusCode).toBe(201);
    expect(copy.json()).toMatchObject({
      title: `Cópia de ${SURVEY.title}`,
      status: 'draft',
      fieldStart: null,
    });

    await call('POST', `/v1/surveys/${survey.id}/unarchive`, { as: 'coordinator' });
    expect(
      (await call('DELETE', `/v1/surveys/${survey.id}`, { as: 'coordinator' })).statusCode,
    ).toBe(204);
    expect((await call('GET', `/v1/surveys/${survey.id}`, { as: 'coordinator' })).statusCode).toBe(
      404,
    );
  });

  it('CA-05: TSE data round-trips and is cleared when the type changes', async () => {
    const created = await call('POST', '/v1/surveys', {
      as: 'coordinator',
      body: {
        ...SURVEY,
        type: 'electoral',
        tse: {
          registrationNumber: 'ba-01234/2026',
          statisticianName: 'Maria Estatística',
          statisticianConre: '1234',
          contractValueCents: 1_250_000,
        },
      },
    });
    expect(created.statusCode).toBe(201);
    const { id } = created.json<{ id: string }>();
    const read = await call('GET', `/v1/surveys/${id}`, { as: 'coordinator' });
    expect(read.json()).toMatchObject({
      tse: {
        registrationNumber: 'BA-01234/2026',
        statisticianName: 'Maria Estatística',
        contractorName: null,
        contractValueCents: 1_250_000,
      },
    });

    const changed = await call('PATCH', `/v1/surveys/${id}`, {
      as: 'coordinator',
      body: { type: 'public_opinion' },
    });
    expect(changed.json()).toMatchObject({ type: 'public_opinion', tse: null });
    const [row] = await owner<{ tse_registered: boolean; tse_statistician_name: string | null }>(
      'SELECT tse_registered, tse_statistician_name FROM surveys WHERE id = $1',
      [id],
    );
    expect(row).toEqual({ tse_registered: false, tse_statistician_name: null });
  });

  it('CA-06: municipalities of other states are accepted (change 1)', async () => {
    const res = await call('POST', '/v1/surveys', {
      as: 'coordinator',
      body: { ...SURVEY, municipalityCodes: [ITAPETINGA, 3143302] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ municipalityCodes: [ITAPETINGA, 3143302] });
  });

  it('CA-06: period, municipality and TSE format are validated', async () => {
    for (const body of [
      { ...SURVEY, fieldEnd: '2026-11-01' },
      { ...SURVEY, municipalityCodes: [2900000] },
      { ...SURVEY, municipalityCodes: [ITAPETINGA, ITAPETINGA] },
      { ...SURVEY, type: 'electoral', tse: { registrationNumber: '01234' } },
      { ...SURVEY, organizationId: '0193a000-0000-7000-8000-000000000000' },
    ]) {
      const res = await call('POST', '/v1/surveys', { as: 'coordinator', body });
      expect(res.statusCode).toBe(400);
    }
  });

  it('lists the surveys of the organization, most recent first', async () => {
    const res = await call('GET', '/v1/surveys', { as: 'adminA' });
    expect(res.statusCode).toBe(200);
    const items = res.json<{ items: { updatedAt: string; municipalityCount: number }[] }>().items;
    expect(items.length).toBeGreaterThan(0);
    const dates = items.map((i) => i.updatedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('isolation and permissions (CA-09)', () => {
  it('another organization sees nothing and cannot use the client', async () => {
    const client = (
      await call('POST', '/v1/clients', { as: 'adminA', body: { name: 'Cliente de A' } })
    ).json<{ id: string }>();
    const survey = (await call('POST', '/v1/surveys', { as: 'adminA', body: SURVEY })).json<{
      id: string;
    }>();

    expect((await call('GET', `/v1/clients/${client.id}`, { as: 'adminB' })).statusCode).toBe(404);
    expect((await call('GET', `/v1/surveys/${survey.id}`, { as: 'adminB' })).statusCode).toBe(404);
    expect(
      (await call('PATCH', `/v1/surveys/${survey.id}`, { as: 'adminB', body: { title: 'Nova' } }))
        .statusCode,
    ).toBe(404);
    expect(
      (await call('POST', `/v1/surveys/${survey.id}/duplicate`, { as: 'adminB' })).statusCode,
    ).toBe(404);
    const foreignClient = await call('POST', '/v1/surveys', {
      as: 'adminB',
      body: { ...SURVEY, clientId: client.id },
    });
    expect(foreignClient.statusCode).toBe(404);
    expect(foreignClient.json()).toMatchObject({ code: 'CLIENT_NOT_FOUND' });
    expect((await call('GET', '/v1/surveys', { as: 'adminB' })).json()).toEqual({ items: [] });
    expect((await call('GET', '/v1/clients', { as: 'adminB' })).json()).toEqual({ items: [] });
  });

  it.each(['analyst', 'client', 'interviewer'])('the %s role gets 403 everywhere', async (role) => {
    const someId = '0193a000-0000-7000-8000-000000000001';
    for (const [method, url] of [
      ['GET', '/v1/clients'],
      ['POST', '/v1/clients'],
      ['GET', `/v1/clients/${someId}`],
      ['PATCH', `/v1/clients/${someId}`],
      ['DELETE', `/v1/clients/${someId}`],
      ['GET', '/v1/surveys'],
      ['POST', '/v1/surveys'],
      ['GET', `/v1/surveys/${someId}`],
      ['PATCH', `/v1/surveys/${someId}`],
      ['DELETE', `/v1/surveys/${someId}`],
      ['POST', `/v1/surveys/${someId}/archive`],
      ['POST', `/v1/surveys/${someId}/unarchive`],
      ['POST', `/v1/surveys/${someId}/duplicate`],
    ] as const) {
      const res = await call(method, url, { as: role, body: method === 'GET' ? undefined : {} });
      expect(res.statusCode, `${method} ${url}`).toBe(403);
    }
  });
});

describe('database guarantees (migration 0005)', () => {
  const orgOf = async (slug: string) =>
    (await owner<{ id: string }>('SELECT id FROM organizations WHERE slug = $1', [slug]))[0]?.id;

  it('the composite FK refuses a survey pointing at a client of another organization', async () => {
    const orgA = await orgOf('a');
    const orgB = await orgOf('b');
    const [clientOfA] = await owner<{ id: string }>(
      'SELECT id FROM clients WHERE organization_id = $1 LIMIT 1',
      [orgA],
    );
    await expect(
      owner(
        `INSERT INTO surveys (id, organization_id, client_id, title, type, status,
           municipality_codes, gps_mode, audio, min_duration_sec)
         VALUES (gen_random_uuid(), $1, $2, 'Pesquisa', 'market', 'draft', '{}', 'off', 'off', 0)`,
        [orgB, clientOfA?.id],
      ),
    ).rejects.toThrow(/surveys_client_fk/);
  });

  it('a municipality code outside the IBGE range is refused', async () => {
    const orgA = await orgOf('a');
    await expect(
      owner(
        `INSERT INTO surveys (id, organization_id, title, type, status, municipality_codes,
           gps_mode, audio, min_duration_sec)
         VALUES (gen_random_uuid(), $1, 'Pesquisa', 'market', 'draft', '{9912345}', 'off', 'off', 0)`,
        [orgA],
      ),
    ).rejects.toThrow(/surveys_municipalities_check/);
  });

  it('TSE data is refused on a survey that is not electoral', async () => {
    const orgA = await orgOf('a');
    await expect(
      owner(
        `INSERT INTO surveys (id, organization_id, title, type, status, municipality_codes,
           gps_mode, audio, min_duration_sec, tse_registered)
         VALUES (gen_random_uuid(), $1, 'Pesquisa', 'market', 'draft', '{}', 'off', 'off', 0, true)`,
        [orgA],
      ),
    ).rejects.toThrow(/surveys_tse_check/);
  });
});
