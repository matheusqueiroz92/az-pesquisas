import { describe, expect, it } from 'vitest';

import { createClient, deleteClient, getClient, listClients, updateClient } from '../clients.js';
import { archiveSurvey, createSurvey } from '../surveys.js';
import { actorOf, createFakes, ORG_B } from './fakes.js';
import type { Fakes } from './fakes.js';

const admin = actorOf('admin');
const coordinator = actorOf('coordinator');
const otherOrg = actorOf('admin', ORG_B);

const CLIENT = {
  name: 'Prefeitura de Itapetinga',
  document: '11222333000181',
  contactName: 'Ana',
  contactEmail: 'ana@itapetinga.ba.gov.br',
  contactPhone: null,
};

const newClient = async (fakes: Fakes, name = CLIENT.name) => {
  const created = await createClient(fakes.deps, coordinator, { ...CLIENT, name });
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value;
};

const newSurvey = async (fakes: Fakes, clientId: string) => {
  const created = await createSurvey(fakes.deps, coordinator, {
    title: 'Avaliação da gestão',
    type: 'municipal_evaluation',
    clientId,
    municipalityCodes: [],
    fieldStart: null,
    fieldEnd: null,
    targetInterviews: null,
    settings: { gps: 'optional', audio: 'off', minDurationSec: 0, consentText: null },
    tse: null,
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value;
};

describe('createClient', () => {
  it('creates the client in the actor organization and audits it (CA-01)', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    expect(client).toMatchObject({ ...CLIENT, surveyCount: 0 });
    expect(fakes.tables.clients.rows.get(client.id)?.organizationId).toBe(admin.organizationId);
    expect(fakes.auditEntries).toEqual([
      expect.objectContaining({ action: 'client.created', entityId: client.id }),
    ]);
  });

  it.each(['analyst', 'client', 'interviewer'] as const)(
    'is forbidden to the %s role (CA-09)',
    async (role) => {
      const fakes = createFakes();
      expect(await createClient(fakes.deps, actorOf(role), CLIENT)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(await listClients(fakes.deps, actorOf(role))).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
    },
  );
});

describe('listClients and getClient', () => {
  it('lists alphabetically with the number of surveys', async () => {
    const fakes = createFakes();
    const b = await newClient(fakes, 'Câmara de Itambé');
    const a = await newClient(fakes, 'Associação Comercial');
    await newSurvey(fakes, b.id);
    await newSurvey(fakes, b.id);

    const list = await listClients(fakes.deps, admin);
    expect(list.ok && list.value.map((c) => [c.name, c.surveyCount])).toEqual([
      ['Associação Comercial', 0],
      ['Câmara de Itambé', 2],
    ]);
    expect(await getClient(fakes.deps, admin, a.id)).toMatchObject({
      ok: true,
      value: { name: 'Associação Comercial', surveyCount: 0 },
    });
  });

  it('does not see clients of another organization (CA-09)', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    expect(await getClient(fakes.deps, otherOrg, client.id)).toEqual({
      ok: false,
      error: 'CLIENT_NOT_FOUND',
    });
    expect(await listClients(fakes.deps, otherOrg)).toEqual({ ok: true, value: [] });
  });
});

describe('updateClient', () => {
  it('saves and audits only the changed fields, never their values', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    fakes.advance(1000);
    const updated = await updateClient(fakes.deps, admin, client.id, {
      contactName: 'Bruno',
      contactEmail: CLIENT.contactEmail,
    });
    expect(updated).toMatchObject({ ok: true, value: { contactName: 'Bruno' } });
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      action: 'client.updated',
      metadata: { changed: ['contactName'] },
    });
  });

  it('does not audit an update that changes nothing', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    await updateClient(fakes.deps, admin, client.id, { name: CLIENT.name });
    expect(fakes.auditEntries).toHaveLength(1);
  });

  it('answers CLIENT_NOT_FOUND for a client of another organization', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    expect(await updateClient(fakes.deps, otherOrg, client.id, { name: 'X Y' })).toEqual({
      ok: false,
      error: 'CLIENT_NOT_FOUND',
    });
  });
});

describe('deleteClient', () => {
  it('removes a client without surveys (CA-03)', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    expect(await deleteClient(fakes.deps, admin, client.id)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(fakes.tables.clients.rows.size).toBe(0);
    expect(fakes.locks).toContain(client.id);
    expect(fakes.auditEntries.at(-1)).toMatchObject({ action: 'client.deleted' });
  });

  it('keeps a client with an archived survey (CA-03)', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    const survey = await newSurvey(fakes, client.id);
    await archiveSurvey(fakes.deps, admin, survey.id);
    expect(await deleteClient(fakes.deps, admin, client.id)).toEqual({
      ok: false,
      error: 'CLIENT_IN_USE',
    });
    expect(fakes.tables.clients.rows.size).toBe(1);
  });

  it('answers CLIENT_NOT_FOUND across organizations and FORBIDDEN to an analyst', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    expect(await deleteClient(fakes.deps, otherOrg, client.id)).toEqual({
      ok: false,
      error: 'CLIENT_NOT_FOUND',
    });
    expect(await deleteClient(fakes.deps, actorOf('analyst'), client.id)).toEqual({
      ok: false,
      error: 'FORBIDDEN',
    });
  });
});
