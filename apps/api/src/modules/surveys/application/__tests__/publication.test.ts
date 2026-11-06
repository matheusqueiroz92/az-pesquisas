import { QuestionnaireSnapshot } from '@az-pesquisas/contracts';
import type { DraftQuestion, QuestionnaireDraft } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import type { SurveyFields } from '../../domain/survey.js';
import {
  getVersion,
  listVersions,
  previewPublication,
  publishQuestionnaire,
} from '../publication.js';
import { saveQuestionnaire } from '../questionnaires.js';
import {
  archiveSurvey,
  closeSurvey,
  createSurvey,
  getSurvey,
  reopenSurvey,
  unarchiveSurvey,
  updateSurvey,
} from '../surveys.js';
import { actorOf, createFakes, ORG_B } from './fakes.js';
import type { Fakes } from './fakes.js';

const coordinator = actorOf('coordinator');

const id = (n: number) => `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const P01 = {
  id: id(101),
  code: 'P01',
  text: 'Você vai votar?',
  required: true,
  type: 'single_choice' as const,
  shuffleOptions: false,
  options: [
    { id: id(102), code: '1', label: 'Sim' },
    { id: id(103), code: '2', label: 'Não' },
  ],
} satisfies DraftQuestion;
const P02: DraftQuestion = {
  id: id(104),
  code: 'P02',
  text: 'Assine',
  required: false,
  type: 'signature',
};
const CONTENT: QuestionnaireDraft = { introText: null, questions: [P01, P02] };

const TSE = {
  registrationNumber: 'BA-01234/2026',
  statisticianName: 'Maria Estatística',
  statisticianConre: '1234',
  contractorName: 'Partido Exemplo',
  contractValueCents: 1_000_000,
};

const setup = async (overrides: Partial<SurveyFields> = {}, content = CONTENT) => {
  const fakes = createFakes();
  const created = await createSurvey(fakes.deps, coordinator, {
    title: 'Intenção de voto',
    type: 'public_opinion',
    clientId: null,
    municipalityCodes: [],
    fieldStart: null,
    fieldEnd: null,
    targetInterviews: null,
    settings: { gps: 'required', audio: 'off', minDurationSec: 0, consentText: 'Aceita?' },
    tse: null,
    ...overrides,
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  const surveyId = created.value.id;
  // A registered survey has a read-only questionnaire: seed it as if saved before.
  const saved = await saveQuestionnaire(fakes.deps, coordinator, surveyId, {
    revision: 0,
    content,
  });
  if (!saved.ok) {
    const row = fakes.tables.surveys.rows.get(surveyId);
    if (!row) {
      throw new Error('fixture');
    }
    fakes.tables.questionnaires.rows.set(surveyId, {
      id: surveyId,
      surveyId,
      organizationId: row.organizationId,
      revision: 1,
      content,
      updatedAt: row.createdAt,
      updatedBy: coordinator.userId,
    });
  }
  return { fakes, surveyId };
};

const save = async (
  fakes: Fakes,
  surveyId: string,
  revision: number,
  content: QuestionnaireDraft,
) => {
  const saved = await saveQuestionnaire(fakes.deps, coordinator, surveyId, { revision, content });
  if (!saved.ok) {
    throw new Error(saved.error);
  }
  return saved.value.revision;
};

describe('publishQuestionnaire', () => {
  it('publishes v1 as a valid snapshot and puts the survey in the field (CA-01)', async () => {
    const { fakes, surveyId } = await setup();
    const preview = await previewPublication(fakes.deps, coordinator, surveyId);
    expect(preview).toMatchObject({
      ok: true,
      value: { revision: 1, nextVersionNumber: 1, blocker: null, changes: [], issues: [] },
    });

    const published = await publishQuestionnaire(fakes.deps, coordinator, surveyId, {
      revision: 1,
    });
    if (!published.ok) {
      throw new Error(published.error);
    }
    const snapshot = QuestionnaireSnapshot.parse(published.value.snapshot);
    expect(snapshot).toMatchObject({
      surveyId,
      versionId: published.value.id,
      versionNumber: 1,
      title: 'Intenção de voto',
      settings: { gps: 'required', audio: 'off', minDurationSec: 0, consentText: 'Aceita?' },
    });
    expect(snapshot.questions.map((q) => q.code)).toEqual(['P01', 'P02']);
    expect(await getSurvey(fakes.deps, coordinator, surveyId)).toMatchObject({
      ok: true,
      value: { status: 'in_field', publishedVersion: 1 },
    });
    expect(fakes.locks).toContain(surveyId);
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      action: 'questionnaire.published',
      entityId: published.value.id,
      metadata: { surveyId, versionNumber: 1, questionCount: 2, changeKinds: [] },
    });
  });

  it('refuses pending issues, stale revisions and unchanged drafts (CA-02)', async () => {
    const { fakes, surveyId } = await setup(
      {},
      { introText: null, questions: [{ ...P01, text: '' }] },
    );
    expect(await previewPublication(fakes.deps, coordinator, surveyId)).toMatchObject({
      ok: true,
      value: { blocker: 'QUESTIONNAIRE_NOT_PUBLISHABLE', issues: [{ code: 'TEXT_EMPTY' }] },
    });
    expect(await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 })).toEqual({
      ok: false,
      error: 'QUESTIONNAIRE_NOT_PUBLISHABLE',
    });
    const revision = await save(fakes, surveyId, 1, CONTENT);
    expect(await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 })).toEqual({
      ok: false,
      error: 'QUESTIONNAIRE_CONFLICT',
    });
    expect((await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision })).ok).toBe(
      true,
    );
    expect(await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision })).toEqual({
      ok: false,
      error: 'QUESTIONNAIRE_UNCHANGED',
    });
  });

  it('publishes v2 with the changes and keeps v1 as it was (CA-03)', async () => {
    const { fakes, surveyId } = await setup();
    await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 });
    const revision = await save(fakes, surveyId, 1, {
      introText: null,
      questions: [
        {
          ...P01,
          text: 'O(a) sr.(a) vai votar?',
          options: [...P01.options, { id: id(105), code: 'NS', label: 'Não sabe' }],
        },
      ],
    });
    const preview = await previewPublication(fakes.deps, coordinator, surveyId);
    expect(preview.ok && preview.value.changes.map((c) => c.kind)).toEqual([
      'question_text',
      'item_added',
      'question_removed',
    ]);
    const v2 = await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision });
    expect(v2.ok && v2.value.number).toBe(2);

    const list = await listVersions(fakes.deps, coordinator, surveyId);
    expect(list.ok && list.value.map((v) => v.number)).toEqual([2, 1]);
    const v1 = await getVersion(fakes.deps, coordinator, surveyId, 1);
    expect(v1.ok && v1.value.snapshot.questions.map((q) => q.text)).toEqual([
      'Você vai votar?',
      'Assine',
    ]);
    expect(await getVersion(fakes.deps, coordinator, surveyId, 9)).toEqual({
      ok: false,
      error: 'QUESTIONNAIRE_VERSION_NOT_FOUND',
    });
  });

  it('refuses a question whose type changed between versions', async () => {
    const { fakes, surveyId } = await setup();
    await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 });
    const revision = await save(fakes, surveyId, 1, {
      introText: null,
      questions: [
        P01,
        { id: P02.id, code: 'P02', text: 'Foto', required: false, type: 'photo', maxPhotos: 1 },
      ],
    });
    expect(await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision })).toEqual({
      ok: false,
      error: 'QUESTIONNAIRE_INCOMPATIBLE',
    });
  });

  it('requires the full TSE data of a registered electoral survey, then fixes the registration (CA-05)', async () => {
    const { fakes, surveyId } = await setup({
      type: 'electoral',
      tse: { ...TSE, statisticianName: null },
    });
    expect(await previewPublication(fakes.deps, coordinator, surveyId)).toMatchObject({
      ok: true,
      value: { blocker: 'SURVEY_TSE_INCOMPLETE', tseMissing: ['statisticianName'] },
    });
    expect(await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 })).toEqual({
      ok: false,
      error: 'SURVEY_TSE_INCOMPLETE',
    });
    await updateSurvey(fakes.deps, coordinator, surveyId, { tse: TSE });
    expect(
      (await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 })).ok,
    ).toBe(true);
    expect(await updateSurvey(fakes.deps, coordinator, surveyId, { tse: null })).toEqual({
      ok: false,
      error: 'SURVEY_FIELD_LOCKED',
    });
  });

  it('does not publish an archived survey', async () => {
    const { fakes, surveyId } = await setup();
    await archiveSurvey(fakes.deps, coordinator, surveyId);
    expect(await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 })).toEqual({
      ok: false,
      error: 'SURVEY_NOT_EDITABLE',
    });
  });
});

describe('survey status after publication (CA-06)', () => {
  it('closes, archives, unarchives and reopens, with audit entries', async () => {
    const { fakes, surveyId } = await setup();
    await publishQuestionnaire(fakes.deps, coordinator, surveyId, { revision: 1 });
    expect(await reopenSurvey(fakes.deps, coordinator, surveyId)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_EDITABLE',
    });
    for (const [call, status] of [
      [closeSurvey, 'closed'],
      [archiveSurvey, 'archived'],
      [unarchiveSurvey, 'closed'],
      [reopenSurvey, 'in_field'],
    ] as const) {
      expect(await call(fakes.deps, coordinator, surveyId)).toMatchObject({
        ok: true,
        value: { status },
      });
    }
    expect(fakes.auditEntries.slice(-4).map((e) => e.action)).toEqual([
      'survey.closed',
      'survey.archived',
      'survey.unarchived',
      'survey.reopened',
    ]);
  });
});

describe('isolation and permission (CA-08)', () => {
  it('answers SURVEY_NOT_FOUND across organizations and FORBIDDEN to other roles', async () => {
    const { fakes, surveyId } = await setup();
    const other = actorOf('admin', ORG_B);
    for (const call of [
      () => previewPublication(fakes.deps, other, surveyId),
      () => publishQuestionnaire(fakes.deps, other, surveyId, { revision: 1 }),
      () => listVersions(fakes.deps, other, surveyId),
      () => getVersion(fakes.deps, other, surveyId, 1),
    ]) {
      expect(await call()).toEqual({ ok: false, error: 'SURVEY_NOT_FOUND' });
    }
    for (const role of ['analyst', 'client', 'interviewer'] as const) {
      const actor = actorOf(role);
      expect(await publishQuestionnaire(fakes.deps, actor, surveyId, { revision: 1 })).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(await previewPublication(fakes.deps, actor, surveyId)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(await listVersions(fakes.deps, actor, surveyId)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(await closeSurvey(fakes.deps, actor, surveyId)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
    }
  });
});
