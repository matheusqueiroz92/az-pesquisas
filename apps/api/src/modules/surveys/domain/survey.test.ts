import { describe, expect, it } from 'vitest';

import { Survey } from './survey.js';
import type { SurveyFields } from './survey.js';

const T0 = new Date('2026-11-05T12:00:00Z');
const T1 = new Date('2026-11-05T13:00:00Z');
const ORG = '0193a000-0000-7000-8000-0000000000a0';
const ID = '0193a000-0000-7000-8000-0000000000d1';
const COPY_ID = '0193a000-0000-7000-8000-0000000000d2';
const CLIENT = '0193a000-0000-7000-8000-0000000000c1';
const ITAPETINGA = 2916401;
const ITAMBE = 2915809;

const TSE = {
  registrationNumber: 'BA-01234/2026',
  statisticianName: 'Maria Estatística',
  statisticianConre: '1234',
  contractorName: 'Partido Exemplo',
  contractValueCents: 1_250_000,
};

const fields = (overrides: Partial<SurveyFields> = {}): SurveyFields => ({
  title: ' Avaliação da gestão municipal ',
  type: 'municipal_evaluation',
  clientId: CLIENT,
  municipalityCodes: [ITAPETINGA, ITAMBE],
  fieldStart: '2026-11-10',
  fieldEnd: '2026-11-20',
  targetInterviews: 600,
  settings: { gps: 'required', audio: 'off', minDurationSec: 180, consentText: null },
  tse: null,
  ...overrides,
});

const create = (overrides: Partial<SurveyFields> = {}) =>
  Survey.create({ id: ID, organizationId: ORG, now: T0, fields: fields(overrides) });

const electoral = () => create({ type: 'electoral', tse: TSE });

describe('Survey.create', () => {
  it('starts as a draft with the title trimmed', () => {
    expect(create().toSnapshot()).toEqual({
      id: ID,
      organizationId: ORG,
      status: 'draft',
      publishedVersion: 0,
      ...fields(),
      title: 'Avaliação da gestão municipal',
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it('accepts municipalities of other states, like the north of Minas Gerais', () => {
    expect(
      create({ municipalityCodes: [ITAPETINGA, 3143302] }).toSnapshot().municipalityCodes,
    ).toEqual([ITAPETINGA, 3143302]);
  });

  it('drops TSE data from a survey that is not electoral', () => {
    expect(create({ tse: TSE }).toSnapshot().tse).toBeNull();
    expect(electoral().toSnapshot().tse).toEqual(TSE);
  });

  it.each([
    ['a short title', { title: ' AB ' }],
    ['field end before start', { fieldStart: '2026-11-20', fieldEnd: '2026-11-10' }],
    ['an unknown municipality code', { municipalityCodes: [2900000] }],
    ['a repeated municipality', { municipalityCodes: [ITAPETINGA, ITAPETINGA] }],
    ['a zero target', { targetInterviews: 0 }],
  ])('refuses %s', (_case, overrides) => {
    expect(() => create(overrides)).toThrow(TypeError);
  });

  it('round-trips through a snapshot', () => {
    const survey = electoral();
    expect(Survey.fromSnapshot(survey.toSnapshot()).toSnapshot()).toEqual(survey.toSnapshot());
    expect(survey.id).toBe(ID);
    expect(survey.status).toBe('draft');
    expect(survey.clientId).toBe(CLIENT);
    expect(survey.title).toBe('Avaliação da gestão municipal');
  });
});

describe('Survey.update', () => {
  it('reports the changed fields and touches updatedAt', () => {
    const survey = create();
    const result = survey.update(
      { targetInterviews: 800, municipalityCodes: [ITAPETINGA, ITAMBE], title: 'Nova avaliação' },
      T1,
    );
    expect(result).toEqual({ ok: true, value: { changed: ['title', 'targetInterviews'] } });
    expect(survey.toSnapshot()).toMatchObject({ targetInterviews: 800, updatedAt: T1 });
  });

  it('compares settings and municipalities by value', () => {
    const survey = create();
    const same = survey.update(
      {
        settings: { gps: 'required', audio: 'off', minDurationSec: 180, consentText: null },
        municipalityCodes: [ITAPETINGA, ITAMBE],
      },
      T1,
    );
    expect(same).toEqual({ ok: true, value: { changed: [] } });
    expect(survey.toSnapshot().updatedAt).toBe(T0);
    expect(
      survey.update({ settings: { ...fields().settings, audio: 'on' }, clientId: null }, T1),
    ).toEqual({ ok: true, value: { changed: ['clientId', 'settings'] } });
  });

  it('clears TSE data when the type stops being electoral', () => {
    const survey = electoral();
    expect(survey.update({ type: 'public_opinion' }, T1)).toEqual({
      ok: true,
      value: { changed: ['type', 'tse'] },
    });
    expect(survey.toSnapshot().tse).toBeNull();
  });

  it('clears TSE data when the registration is unmarked', () => {
    const survey = electoral();
    expect(survey.update({ tse: null }, T1)).toEqual({ ok: true, value: { changed: ['tse'] } });
  });

  it('checks the period against the stored value', () => {
    expect(() => create().update({ fieldEnd: '2026-11-01' }, T1)).toThrow(TypeError);
  });

  it('refuses changes to an archived survey', () => {
    const survey = create();
    survey.archive(T1);
    expect(survey.update({ targetInterviews: 1 }, T1)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_EDITABLE',
    });
  });
});

describe('archive and unarchive', () => {
  it('moves a draft to archived and back', () => {
    const survey = create();
    expect(survey.archive(T1)).toEqual({ ok: true, value: undefined });
    expect(survey.toSnapshot()).toMatchObject({ status: 'archived', updatedAt: T1 });
    expect(survey.archive(T1).ok).toBe(false);
    expect(survey.canBeDeleted()).toBe(false);
    expect(survey.unarchive(T1)).toEqual({ ok: true, value: undefined });
    expect(survey.status).toBe('draft');
    expect(survey.canBeDeleted()).toBe(true);
  });

  it('cannot unarchive what is not archived', () => {
    expect(create().unarchive(T1)).toEqual({ ok: false, error: 'SURVEY_NOT_EDITABLE' });
  });

  it('only archives a draft for now (in field and closed come with spec 015)', () => {
    const survey = Survey.fromSnapshot({ ...create().toSnapshot(), status: 'in_field' });
    expect(survey.archive(T1)).toEqual({ ok: false, error: 'SURVEY_NOT_EDITABLE' });
    expect(survey.canBeDeleted()).toBe(false);
  });
});

describe('Survey.duplicate', () => {
  it('copies settings into a new draft without period or TSE number', () => {
    const original = electoral();
    original.archive(T1);
    const copy = original.duplicate({ id: COPY_ID, title: 'Cópia de Avaliação', now: T1 });
    expect(copy.toSnapshot()).toEqual({
      ...original.toSnapshot(),
      id: COPY_ID,
      title: 'Cópia de Avaliação',
      status: 'draft',
      fieldStart: null,
      fieldEnd: null,
      tse: { ...TSE, registrationNumber: null },
      createdAt: T1,
      updatedAt: T1,
    });
  });

  it('cuts a long title to the limit', () => {
    const copy = create().duplicate({ id: COPY_ID, title: `Cópia de ${'x'.repeat(200)}`, now: T1 });
    expect(copy.title).toHaveLength(160);
  });

  it('keeps a missing TSE block missing', () => {
    expect(
      create().duplicate({ id: COPY_ID, title: 'Cópia', now: T1 }).toSnapshot().tse,
    ).toBeNull();
  });
});

describe('after publication (spec 015)', () => {
  const published = (overrides: Partial<SurveyFields> = {}) => {
    const survey = create(overrides);
    expect(survey.markPublished(1, T1)).toEqual({ ok: true, value: undefined });
    return survey;
  };

  it('the first publication puts a draft in the field; the next ones keep the status', () => {
    const survey = published();
    expect(survey.toSnapshot()).toMatchObject({ status: 'in_field', publishedVersion: 1 });
    expect(survey.markPublished(3, T1)).toEqual({ ok: false, error: 'SURVEY_NOT_EDITABLE' });
    survey.close(T1);
    expect(survey.markPublished(2, T1).ok).toBe(true);
    expect(survey.toSnapshot()).toMatchObject({ status: 'closed', publishedVersion: 2 });
    expect(survey.canBeDeleted()).toBe(false);
  });

  it('cycles in field ⇄ closed → archived → closed (CA-06)', () => {
    const survey = published();
    expect(survey.reopen(T1).ok).toBe(false);
    expect(survey.archive(T1).ok).toBe(false);
    expect(survey.close(T1).ok).toBe(true);
    expect(survey.close(T1).ok).toBe(false);
    expect(survey.archive(T1).ok).toBe(true);
    expect(survey.markPublished(2, T1)).toEqual({ ok: false, error: 'SURVEY_NOT_EDITABLE' });
    expect(survey.unarchive(T1).ok).toBe(true);
    expect(survey.status).toBe('closed');
    expect(survey.reopen(T1).ok).toBe(true);
    expect(survey.status).toBe('in_field');
  });

  it('keeps data editable but fixes the type (CA-06)', () => {
    const survey = published();
    expect(survey.update({ targetInterviews: 900 }, T1)).toEqual({
      ok: true,
      value: { changed: ['targetInterviews'] },
    });
    expect(survey.update({ type: 'market' }, T1)).toEqual({
      ok: false,
      error: 'SURVEY_FIELD_LOCKED',
    });
  });

  it('fixes a TSE registration but lets the other TSE data be corrected (CA-05)', () => {
    const survey = published({ type: 'electoral', tse: TSE });
    expect(survey.update({ tse: null }, T1)).toEqual({ ok: false, error: 'SURVEY_FIELD_LOCKED' });
    expect(survey.update({ tse: { ...TSE, registrationNumber: 'BA-09999/2026' } }, T1)).toEqual({
      ok: false,
      error: 'SURVEY_FIELD_LOCKED',
    });
    expect(
      survey.update({ tse: { ...TSE, statisticianName: 'Maria S. Estatística' } }, T1),
    ).toEqual({
      ok: true,
      value: { changed: ['tse'] },
    });
  });

  it('lets an electoral survey without a number get one later', () => {
    const survey = published({ type: 'electoral', tse: { ...TSE, registrationNumber: null } });
    expect(survey.update({ tse: TSE }, T1).ok).toBe(true);
  });
});
