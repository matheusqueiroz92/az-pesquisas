import { describe, expect, it } from 'vitest';

import type { SurveyFields } from '../../domain/survey.js';
import { createClient } from '../clients.js';
import {
  archiveSurvey,
  createSurvey,
  deleteSurvey,
  duplicateSurvey,
  getSurvey,
  listSurveys,
  unarchiveSurvey,
  updateSurvey,
} from '../surveys.js';
import { actorOf, createFakes, ORG_B } from './fakes.js';
import type { Fakes } from './fakes.js';

const coordinator = actorOf('coordinator');
const otherOrg = actorOf('admin', ORG_B);
const ITAPETINGA = 2916401;
const ITAMBE = 2915809;
const MISSING = '0193a000-0000-7000-8000-00000000ffff';

const TSE = {
  registrationNumber: 'BA-01234/2026',
  statisticianName: 'Maria Estatística',
  statisticianConre: '1234',
  contractorName: null,
  contractValueCents: 1_250_000,
};

const fields = (overrides: Partial<SurveyFields> = {}): SurveyFields => ({
  title: 'Avaliação da gestão municipal de Itapetinga',
  type: 'municipal_evaluation',
  clientId: null,
  municipalityCodes: [ITAPETINGA, ITAMBE],
  fieldStart: '2026-11-10',
  fieldEnd: '2026-11-20',
  targetInterviews: 600,
  settings: { gps: 'required', audio: 'off', minDurationSec: 0, consentText: null },
  tse: null,
  ...overrides,
});

const newClient = async (fakes: Fakes, actor = coordinator) => {
  const created = await createClient(fakes.deps, actor, {
    name: 'Prefeitura de Itapetinga',
    document: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value;
};

const newSurvey = async (fakes: Fakes, overrides: Partial<SurveyFields> = {}) => {
  const created = await createSurvey(fakes.deps, coordinator, fields(overrides));
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value;
};

describe('createSurvey', () => {
  it('creates a draft with the client name and audits it (CA-04)', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    const survey = await newSurvey(fakes, { clientId: client.id });
    expect(survey).toMatchObject({
      status: 'draft',
      clientName: 'Prefeitura de Itapetinga',
      municipalityCodes: [ITAPETINGA, ITAMBE],
      targetInterviews: 600,
      settings: { gps: 'required' },
    });
    expect(fakes.locks).toContain(client.id);
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      action: 'survey.created',
      entityId: survey.id,
    });
  });

  it('refuses a client of another organization (CA-09)', async () => {
    const fakes = createFakes();
    const foreign = await newClient(fakes, otherOrg);
    expect(await createSurvey(fakes.deps, coordinator, fields({ clientId: foreign.id }))).toEqual({
      ok: false,
      error: 'CLIENT_NOT_FOUND',
    });
  });

  it.each(['analyst', 'client', 'interviewer'] as const)(
    'is forbidden to the %s role (CA-09)',
    async (role) => {
      const fakes = createFakes();
      const actor = actorOf(role);
      for (const call of [
        () => createSurvey(fakes.deps, actor, fields()),
        () => listSurveys(fakes.deps, actor),
        () => getSurvey(fakes.deps, actor, MISSING),
        () => updateSurvey(fakes.deps, actor, MISSING, { title: 'Outra' }),
        () => archiveSurvey(fakes.deps, actor, MISSING),
        () => unarchiveSurvey(fakes.deps, actor, MISSING),
        () => duplicateSurvey(fakes.deps, actor, MISSING),
        () => deleteSurvey(fakes.deps, actor, MISSING),
      ]) {
        expect(await call()).toEqual({ ok: false, error: 'FORBIDDEN' });
      }
    },
  );
});

describe('listSurveys and getSurvey', () => {
  it('lists the most recently changed first, with client and municipality count', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    const first = await newSurvey(fakes, { title: 'Primeira' });
    fakes.advance(1000);
    await newSurvey(fakes, { title: 'Segunda', clientId: client.id, municipalityCodes: [] });
    fakes.advance(1000);
    await updateSurvey(fakes.deps, coordinator, first.id, { targetInterviews: 700 });

    const list = await listSurveys(fakes.deps, coordinator);
    expect(list.ok && list.value.map((s) => [s.title, s.clientName, s.municipalityCount])).toEqual([
      ['Primeira', null, 2],
      ['Segunda', 'Prefeitura de Itapetinga', 0],
    ]);
  });

  it('isolates organizations (CA-09)', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    expect(await getSurvey(fakes.deps, otherOrg, survey.id)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_FOUND',
    });
    expect(await listSurveys(fakes.deps, otherOrg)).toEqual({ ok: true, value: [] });
    expect(await getSurvey(fakes.deps, coordinator, survey.id)).toMatchObject({
      ok: true,
      value: { id: survey.id, clientName: null },
    });
  });
});

describe('updateSurvey', () => {
  it('audits the changed fields only', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    const survey = await newSurvey(fakes);
    const updated = await updateSurvey(fakes.deps, coordinator, survey.id, {
      clientId: client.id,
      targetInterviews: 600,
    });
    expect(updated).toMatchObject({ ok: true, value: { clientName: 'Prefeitura de Itapetinga' } });
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      action: 'survey.updated',
      metadata: { changed: ['clientId'] },
    });
  });

  it('clears TSE data when the type changes (CA-05)', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes, { type: 'electoral', tse: TSE });
    expect(survey.tse).toEqual(TSE);
    const updated = await updateSurvey(fakes.deps, coordinator, survey.id, {
      type: 'public_opinion',
    });
    expect(updated).toMatchObject({ ok: true, value: { tse: null } });
  });

  it('does not save or audit when nothing changed', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    await updateSurvey(fakes.deps, coordinator, survey.id, { targetInterviews: 600 });
    expect(fakes.auditEntries).toHaveLength(1);
  });

  it.each([
    ['SURVEY_NOT_FOUND', MISSING, {}],
    ['CLIENT_NOT_FOUND', undefined, { clientId: MISSING }],
  ])('answers %s', async (error, id, changes) => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    expect(
      await updateSurvey(fakes.deps, coordinator, id ?? survey.id, { title: 'Nova', ...changes }),
    ).toEqual({ ok: false, error });
  });

  it('refuses to edit an archived survey (CA-07)', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    await archiveSurvey(fakes.deps, coordinator, survey.id);
    expect(await updateSurvey(fakes.deps, coordinator, survey.id, { title: 'Nova' })).toEqual({
      ok: false,
      error: 'SURVEY_NOT_EDITABLE',
    });
  });
});

describe('archive, unarchive and delete (CA-07)', () => {
  it('follows the draft ⇄ archived cycle and deletes only a draft', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);

    expect(await archiveSurvey(fakes.deps, coordinator, survey.id)).toMatchObject({
      ok: true,
      value: { status: 'archived' },
    });
    expect(await archiveSurvey(fakes.deps, coordinator, survey.id)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_EDITABLE',
    });
    expect(await deleteSurvey(fakes.deps, coordinator, survey.id)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_EDITABLE',
    });
    expect(await unarchiveSurvey(fakes.deps, coordinator, survey.id)).toMatchObject({
      ok: true,
      value: { status: 'draft' },
    });
    expect(await deleteSurvey(fakes.deps, coordinator, survey.id)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(fakes.tables.surveys.rows.size).toBe(0);
    expect(fakes.auditEntries.map((e) => e.action)).toEqual([
      'survey.created',
      'survey.archived',
      'survey.unarchived',
      'survey.deleted',
    ]);
  });

  it.each([
    ['archive', archiveSurvey],
    ['unarchive', unarchiveSurvey],
    ['delete', deleteSurvey],
    ['duplicate', duplicateSurvey],
  ] as const)('%s answers SURVEY_NOT_FOUND across organizations', async (_name, call) => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    expect(await call(fakes.deps, otherOrg, survey.id)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_FOUND',
    });
  });
});

describe('duplicateSurvey (CA-08)', () => {
  it('creates a draft copy without period or TSE number', async () => {
    const fakes = createFakes();
    const client = await newClient(fakes);
    const original = await newSurvey(fakes, { type: 'electoral', tse: TSE, clientId: client.id });
    await archiveSurvey(fakes.deps, coordinator, original.id);

    const copy = await duplicateSurvey(fakes.deps, coordinator, original.id);
    expect(copy).toMatchObject({
      ok: true,
      value: {
        title: 'Cópia de Avaliação da gestão municipal de Itapetinga',
        status: 'draft',
        type: 'electoral',
        clientName: 'Prefeitura de Itapetinga',
        municipalityCodes: [ITAPETINGA, ITAMBE],
        fieldStart: null,
        fieldEnd: null,
        tse: { ...TSE, registrationNumber: null },
      },
    });
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      action: 'survey.duplicated',
      metadata: { sourceSurveyId: original.id },
    });
  });
});
