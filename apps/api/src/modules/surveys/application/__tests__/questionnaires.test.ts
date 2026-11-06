import type { QuestionnaireDraft } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import type { SurveyFields } from '../../domain/survey.js';
import { getQuestionnaire, saveQuestionnaire } from '../questionnaires.js';
import { archiveSurvey, createSurvey, deleteSurvey, duplicateSurvey } from '../surveys.js';
import { actorOf, createFakes, ORG_B } from './fakes.js';
import type { Fakes } from './fakes.js';

const coordinator = actorOf('coordinator');
const MISSING = '0193a000-0000-7000-8000-00000000ffff';

const CONTENT: QuestionnaireDraft = {
  introText: null,
  questions: [
    {
      id: '0193a000-0000-7000-8000-000000000101',
      code: 'P01',
      text: 'Sexo',
      required: true,
      type: 'single_choice',
      shuffleOptions: false,
      options: [
        { id: '0193a000-0000-7000-8000-000000000102', code: '1', label: 'Masculino' },
        { id: '0193a000-0000-7000-8000-000000000103', code: '2', label: 'Feminino' },
      ],
    },
  ],
};

const newSurvey = async (fakes: Fakes, overrides: Partial<SurveyFields> = {}) => {
  const created = await createSurvey(fakes.deps, coordinator, {
    title: 'Pesquisa de opinião',
    type: 'public_opinion',
    clientId: null,
    municipalityCodes: [],
    fieldStart: null,
    fieldEnd: null,
    targetInterviews: null,
    settings: { gps: 'optional', audio: 'off', minDurationSec: 0, consentText: null },
    tse: null,
    ...overrides,
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value;
};

describe('getQuestionnaire', () => {
  it('returns an empty draft at revision 0 before the first save', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    expect(await getQuestionnaire(fakes.deps, coordinator, survey.id)).toEqual({
      ok: true,
      value: {
        surveyId: survey.id,
        revision: 0,
        content: { introText: null, questions: [] },
        lock: null,
        updatedAt: null,
      },
    });
  });

  it('answers SURVEY_NOT_FOUND across organizations and FORBIDDEN to other roles (CA-09)', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    expect(await getQuestionnaire(fakes.deps, actorOf('admin', ORG_B), survey.id)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_FOUND',
    });
    for (const role of ['analyst', 'client', 'interviewer'] as const) {
      expect(await getQuestionnaire(fakes.deps, actorOf(role), survey.id)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(
        await saveQuestionnaire(fakes.deps, actorOf(role), survey.id, {
          revision: 0,
          content: CONTENT,
        }),
      ).toEqual({ ok: false, error: 'FORBIDDEN' });
    }
  });
});

describe('saveQuestionnaire', () => {
  it('saves under the survey lock, bumps the revision and reads back (CA-01)', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    const saved = await saveQuestionnaire(fakes.deps, coordinator, survey.id, {
      revision: 0,
      content: CONTENT,
    });
    expect(saved).toMatchObject({ ok: true, value: { revision: 1, lock: null } });
    expect(fakes.locks).toContain(survey.id);
    expect(await getQuestionnaire(fakes.deps, coordinator, survey.id)).toMatchObject({
      ok: true,
      value: { revision: 1, content: CONTENT, updatedAt: fakes.deps.clock.now() },
    });
  });

  it('refuses a save from an old revision (CA-06)', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    await saveQuestionnaire(fakes.deps, coordinator, survey.id, { revision: 0, content: CONTENT });
    expect(
      await saveQuestionnaire(fakes.deps, coordinator, survey.id, {
        revision: 0,
        content: { introText: 'outra aba', questions: [] },
      }),
    ).toEqual({ ok: false, error: 'QUESTIONNAIRE_CONFLICT' });
    const current = await getQuestionnaire(fakes.deps, coordinator, survey.id);
    expect(current.ok && current.value.content).toEqual(CONTENT);
  });

  it('refuses to save an archived survey or one registered at the TSE (CA-07)', async () => {
    const fakes = createFakes();
    const archived = await newSurvey(fakes);
    await archiveSurvey(fakes.deps, coordinator, archived.id);
    const registered = await newSurvey(fakes, {
      type: 'electoral',
      tse: {
        registrationNumber: 'BA-01234/2026',
        statisticianName: null,
        statisticianConre: null,
        contractorName: null,
        contractValueCents: null,
      },
    });
    for (const [survey, lock] of [
      [archived, 'archived'],
      [registered, 'tse_registered'],
    ] as const) {
      expect(
        await saveQuestionnaire(fakes.deps, coordinator, survey.id, {
          revision: 0,
          content: CONTENT,
        }),
      ).toEqual({ ok: false, error: 'QUESTIONNAIRE_LOCKED' });
      expect(await getQuestionnaire(fakes.deps, coordinator, survey.id)).toMatchObject({
        ok: true,
        value: { lock },
      });
    }
  });

  it('answers SURVEY_NOT_FOUND for another organization', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    expect(
      await saveQuestionnaire(fakes.deps, actorOf('admin', ORG_B), survey.id, {
        revision: 0,
        content: CONTENT,
      }),
    ).toEqual({ ok: false, error: 'SURVEY_NOT_FOUND' });
    expect(
      await saveQuestionnaire(fakes.deps, coordinator, MISSING, { revision: 0, content: CONTENT }),
    ).toEqual({ ok: false, error: 'SURVEY_NOT_FOUND' });
  });
});

describe('with the survey lifecycle', () => {
  it('duplicating a survey copies its questionnaire with new ids (CA-08)', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    await saveQuestionnaire(fakes.deps, coordinator, survey.id, { revision: 0, content: CONTENT });
    const copy = await duplicateSurvey(fakes.deps, coordinator, survey.id);
    if (!copy.ok) {
      throw new Error(copy.error);
    }
    const read = await getQuestionnaire(fakes.deps, coordinator, copy.value.id);
    if (!read.ok) {
      throw new Error(read.error);
    }
    const [question] = read.value.content.questions;
    expect(question).toMatchObject({ code: 'P01', text: 'Sexo' });
    expect(question?.id).not.toBe(CONTENT.questions[0]?.id);
    expect(read.value.revision).toBe(1);
    expect(fakes.auditEntries.at(-1)).toMatchObject({ metadata: { questionCount: 1 } });
  });

  it('duplicating a survey without questionnaire leaves the copy empty', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    const copy = await duplicateSurvey(fakes.deps, coordinator, survey.id);
    expect(copy.ok && fakes.tables.questionnaires.rows.size).toBe(0);
  });

  it('deleting a draft survey removes its questionnaire', async () => {
    const fakes = createFakes();
    const survey = await newSurvey(fakes);
    await saveQuestionnaire(fakes.deps, coordinator, survey.id, { revision: 0, content: CONTENT });
    await deleteSurvey(fakes.deps, coordinator, survey.id);
    expect(fakes.tables.questionnaires.rows.size).toBe(0);
  });
});
