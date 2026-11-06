import type { QuestionnaireDraft } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import { Questionnaire } from './questionnaire.js';
import { Survey } from './survey.js';

const ORG = '0193a000-0000-7000-8000-0000000000a0';
const SURVEY = '0193a000-0000-7000-8000-0000000000d1';
const COPY = '0193a000-0000-7000-8000-0000000000d2';
const USER = '0193a000-0000-7000-8000-0000000000e1';
const T0 = new Date('2026-11-06T12:00:00Z');

const CONTENT: QuestionnaireDraft = {
  introText: 'Olá',
  questions: [
    {
      id: '0193a000-0000-7000-8000-000000000101',
      code: 'P01',
      text: 'Avalie',
      required: true,
      type: 'matrix',
      rows: [{ id: '0193a000-0000-7000-8000-000000000102', code: 'S', label: 'Saúde' }],
      options: [
        { id: '0193a000-0000-7000-8000-000000000103', code: '1', label: 'Bom' },
        { id: '0193a000-0000-7000-8000-000000000104', code: '2', label: 'Ruim' },
      ],
    },
    {
      id: '0193a000-0000-7000-8000-000000000105',
      code: 'P02',
      text: 'Assine',
      required: false,
      type: 'signature',
      visibleIf: { question: 'P01', op: 'answered' },
    },
  ],
};

describe('Questionnaire', () => {
  it('starts empty at revision 0 and counts its questions', () => {
    const q = Questionnaire.empty(SURVEY, ORG);
    expect(q.toSnapshot()).toEqual({
      surveyId: SURVEY,
      organizationId: ORG,
      revision: 0,
      content: { introText: null, questions: [] },
      updatedAt: null,
      updatedBy: null,
    });
    expect(q.questionCount).toBe(0);
  });

  it('replaces the content when the revision matches (CA-06)', () => {
    const q = Questionnaire.empty(SURVEY, ORG);
    expect(q.replace(CONTENT, { expectedRevision: 0, now: T0, by: USER })).toEqual({
      ok: true,
      value: undefined,
    });
    expect(q.revision).toBe(1);
    expect(q.questionCount).toBe(2);
    expect(q.toSnapshot()).toMatchObject({ updatedAt: T0, updatedBy: USER });
    expect(q.replace(CONTENT, { expectedRevision: 0, now: T0, by: USER })).toEqual({
      ok: false,
      error: 'QUESTIONNAIRE_CONFLICT',
    });
    expect(Questionnaire.fromSnapshot(q.toSnapshot()).revision).toBe(1);
  });

  it('copies with new ids but the same codes, texts and conditions (CA-08)', () => {
    const q = Questionnaire.empty(SURVEY, ORG);
    q.replace(CONTENT, { expectedRevision: 0, now: T0, by: USER });
    let n = 0;
    const copy = q
      .copyFor({
        surveyId: COPY,
        now: T0,
        by: USER,
        newId: () => {
          n += 1;
          return `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
        },
      })
      .toSnapshot();
    expect(copy.surveyId).toBe(COPY);
    expect(copy.revision).toBe(1);
    const [matrix, signature] = copy.content.questions;
    expect(matrix?.id).toBe('0193a000-0000-7000-8000-000000000001');
    expect(matrix?.type === 'matrix' && matrix.options[0]?.id).toBe(
      '0193a000-0000-7000-8000-000000000002',
    );
    expect(matrix?.type === 'matrix' && matrix.rows[0]?.id).toBe(
      '0193a000-0000-7000-8000-000000000004',
    );
    expect(matrix?.type === 'matrix' && matrix.options.map((o) => o.code)).toEqual(['1', '2']);
    expect(signature).toMatchObject({
      code: 'P02',
      visibleIf: { question: 'P01', op: 'answered' },
    });
    expect(n).toBe(5);
    // The original is untouched.
    expect(q.toSnapshot().content).toEqual(CONTENT);
  });
});

describe('Survey.questionnaireLock', () => {
  const survey = (overrides: Partial<Parameters<typeof Survey.create>[0]['fields']> = {}) =>
    Survey.create({
      id: SURVEY,
      organizationId: ORG,
      now: T0,
      fields: {
        title: 'Pesquisa eleitoral',
        type: 'electoral',
        clientId: null,
        municipalityCodes: [],
        fieldStart: null,
        fieldEnd: null,
        targetInterviews: null,
        settings: { gps: 'off', audio: 'off', minDurationSec: 0, consentText: null },
        tse: null,
        ...overrides,
      },
    });
  const TSE = {
    registrationNumber: null,
    statisticianName: null,
    statisticianConre: null,
    contractorName: null,
    contractValueCents: null,
  };

  it('is open for a draft, even electoral registered without a number yet', () => {
    expect(survey().questionnaireLock()).toBeNull();
    expect(survey({ tse: TSE }).questionnaireLock()).toBeNull();
  });

  it('locks a survey with a TSE registration number (CA-07)', () => {
    expect(
      survey({ tse: { ...TSE, registrationNumber: 'BA-01234/2026' } }).questionnaireLock(),
    ).toBe('tse_registered');
  });

  it('locks an archived survey (CA-07)', () => {
    const s = survey();
    s.archive(T0);
    expect(s.questionnaireLock()).toBe('archived');
  });
});
