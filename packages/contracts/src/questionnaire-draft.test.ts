import { describe, expect, it } from 'vitest';

import { QuestionnaireSnapshot } from './questionnaire.js';
import {
  draftToSnapshotInput,
  lintQuestionnaire,
  QuestionnaireDraft,
  renameInCondition,
  SaveQuestionnaireRequest,
} from './questionnaire-draft.js';
import type { DraftQuestion } from './questionnaire-draft.js';

let counter = 0;
const id = () => {
  counter += 1;
  return `0193a000-0000-7000-8000-${String(counter).padStart(12, '0')}`;
};

const option = (code: string, label: string, extra: Record<string, boolean> = {}) => ({
  id: id(),
  code,
  label,
  ...extra,
});

const single = (code: string, overrides: Partial<DraftQuestion> = {}): DraftQuestion =>
  ({
    id: id(),
    code,
    text: 'Você vai votar?',
    required: true,
    type: 'single_choice',
    options: [option('1', 'Sim'), option('2', 'Não')],
    shuffleOptions: false,
    ...overrides,
  }) as DraftQuestion;

/** One question of every type, all complete: must become a valid snapshot. */
const fullDraft = (): QuestionnaireDraft => ({
  introText: 'Bom dia, somos da AZ Pesquisas.',
  questions: [
    single('P01_VOTA'),
    {
      id: id(),
      code: 'P02',
      text: 'Em quem?',
      helpText: '   ',
      required: true,
      type: 'multiple_choice',
      options: [option('1', 'A'), option('2', 'B'), option('NS', 'Nenhum', { exclusive: true })],
      shuffleOptions: true,
      minSelections: 1,
      maxSelections: 2,
      visibleIf: { all: [{ question: 'P01_VOTA', op: 'eq', value: '1' }] },
    },
    {
      id: id(),
      code: 'P03',
      text: 'Por quê?',
      required: false,
      type: 'text',
      multiline: true,
      maxLength: 500,
    },
    {
      id: id(),
      code: 'P04_IDADE',
      text: 'Idade',
      required: true,
      type: 'number',
      integer: true,
      min: 16,
      max: 120,
      unit: 'anos',
    },
    {
      id: id(),
      code: 'P05',
      text: 'Nota',
      required: true,
      type: 'scale',
      min: 0,
      max: 10,
      minLabel: 'Péssimo',
      maxLabel: 'Ótimo',
      visibleIf: { any: [{ question: 'P04_IDADE', op: 'gte', value: 18 }] },
    },
    {
      id: id(),
      code: 'P06',
      text: 'Avalie',
      required: true,
      type: 'matrix',
      rows: [{ id: id(), code: 'SAUDE', label: 'Saúde' }],
      options: [option('1', 'Bom'), option('2', 'Ruim')],
    },
    {
      id: id(),
      code: 'P07',
      text: 'Ordene',
      required: true,
      type: 'ranking',
      options: [option('1', 'A'), option('2', 'B'), option('3', 'C')],
      maxRanked: 2,
    },
    {
      id: id(),
      code: 'P08',
      text: 'Data',
      required: false,
      type: 'date',
      min: '2026-01-01',
      max: '2026-12-31',
    },
    { id: id(), code: 'P09', text: 'Foto', required: false, type: 'photo', maxPhotos: 2 },
    { id: id(), code: 'P10', text: 'Assine', required: false, type: 'signature' },
  ],
});

const META = {
  surveyId: '0193a000-0000-7000-8000-00000000aaaa',
  versionId: '0193a000-0000-7000-8000-00000000bbbb',
  versionNumber: 1,
  title: 'Pesquisa',
  settings: { gps: 'optional' as const, audio: 'off' as const, minDurationSec: 0 },
};

const codesOf = (draft: QuestionnaireDraft) => lintQuestionnaire(draft).map((i) => i.code);

describe('QuestionnaireDraft', () => {
  it('accepts an incomplete draft while it is being edited', () => {
    const draft = QuestionnaireDraft.parse({
      questions: [single('', { text: '', options: [option('', '')] })],
    });
    expect(draft.introText).toBeNull();
  });

  it('rejects unknown fields and wrong types', () => {
    expect(
      QuestionnaireDraft.safeParse({ questions: [{ ...single('P1'), hacked: true }] }).success,
    ).toBe(false);
    expect(
      QuestionnaireDraft.safeParse({ questions: [{ ...single('P1'), type: 'video' }] }).success,
    ).toBe(false);
    expect(
      SaveQuestionnaireRequest.safeParse({ revision: -1, content: { questions: [] } }).success,
    ).toBe(false);
  });
});

describe('lintQuestionnaire', () => {
  it('finds nothing in a complete questionnaire, which becomes a valid snapshot (CA-05)', () => {
    const draft = fullDraft();
    expect(lintQuestionnaire(draft)).toEqual([]);
    const snapshot = QuestionnaireSnapshot.parse(draftToSnapshotInput(draft, META));
    expect(snapshot.questions).toHaveLength(10);
    expect(snapshot.introText).toBe('Bom dia, somos da AZ Pesquisas.');
    expect('helpText' in (snapshot.questions[1] ?? {})).toBe(false);
  });

  it('asks for at least one question', () => {
    expect(codesOf({ introText: null, questions: [] })).toEqual(['NO_QUESTIONS']);
  });

  it.each([
    ['TEXT_EMPTY', single('P1', { text: '  ' })],
    ['CODE_INVALID', single('p 1')],
    ['OPTIONS_TOO_FEW', single('P1', { options: [option('1', 'Sim')] })],
    ['ITEM_LABEL_EMPTY', single('P1', { options: [option('1', ''), option('2', 'Não')] })],
    ['ITEM_CODE_INVALID', single('P1', { options: [option('1 2', 'A'), option('2', 'B')] })],
    ['ITEM_CODE_REPEATED', single('P1', { options: [option('1', 'A'), option('1', 'B')] })],
    [
      'OTHER_REPEATED',
      single('P1', {
        options: [option('1', 'A', { other: true }), option('2', 'B', { other: true })],
      }),
    ],
  ])('flags %s', (code, question) => {
    expect(codesOf({ introText: null, questions: [question] })).toContain(code);
  });

  it('flags repeated question codes on the second one', () => {
    const second = single('P1');
    expect(lintQuestionnaire({ introText: null, questions: [single('P1'), second] })).toEqual([
      { code: 'CODE_REPEATED', questionId: second.id },
    ]);
  });

  it('flags item issues with list and position', () => {
    const q = single('P1', { options: [option('1', 'A'), option('2', '')] });
    expect(lintQuestionnaire({ introText: null, questions: [q] })).toEqual([
      { code: 'ITEM_LABEL_EMPTY', questionId: q.id, list: 'options', item: 1 },
    ]);
  });

  it.each([
    ['SELECTIONS_RANGE', 3],
    ['SCALE_RANGE', 4],
    ['NUMBER_RANGE', 3],
    ['DATE_RANGE', 7],
    ['RANKED_TOO_MANY', 6],
  ] as const)('flags %s', (code, index) => {
    const draft = fullDraft();
    const questions = draft.questions.map((q, i) => {
      if (i !== index && !(code === 'SELECTIONS_RANGE' && i === 1)) {
        return q;
      }
      switch (q.type) {
        case 'multiple_choice':
          return { ...q, minSelections: 3, maxSelections: 2 };
        case 'scale':
          return { ...q, min: 5, max: 5 };
        case 'number':
          return { ...q, min: 10, max: 1 };
        case 'date':
          return { ...q, min: '2026-12-31', max: '2026-01-01' };
        case 'ranking':
          return { ...q, maxRanked: 9 };
        default:
          return q;
      }
    });
    expect(codesOf({ ...draft, questions })).toContain(code);
  });

  it('flags a matrix without rows or columns', () => {
    const matrix = fullDraft().questions[5];
    if (matrix?.type !== 'matrix') {
      throw new Error('fixture');
    }
    expect(codesOf({ introText: null, questions: [{ ...matrix, rows: [], options: [] }] })).toEqual(
      ['ROWS_EMPTY', 'OPTIONS_TOO_FEW'],
    );
    expect(
      codesOf({
        introText: null,
        questions: [{ ...matrix, rows: [{ id: id(), code: 'X', label: '' }] }],
      }),
    ).toEqual(['ITEM_LABEL_EMPTY']);
  });

  it('flags a condition on a later or unknown question (CA-03)', () => {
    const draft = fullDraft();
    const [first, second, ...rest] = draft.questions;
    if (!first || !second) {
      throw new Error('fixture');
    }
    expect(lintQuestionnaire({ ...draft, questions: [second, first, ...rest] })).toEqual([
      { code: 'CONDITION_REFERENCE', questionId: second.id },
    ]);
  });

  it('falls back to the snapshot rules for what the specific checks miss', () => {
    const draft = fullDraft();
    const questions = draft.questions.map((q, i) =>
      // "gt" on a choice question: valid shape, invalid meaning.
      i === 1 ? { ...q, visibleIf: { question: 'P01_VOTA', op: 'gt' as const, value: 1 } } : q,
    );
    expect(lintQuestionnaire({ ...draft, questions })).toEqual([
      { code: 'CONDITION_INVALID', questionId: draft.questions[1]?.id },
    ]);
  });
});

describe('renameInCondition', () => {
  it('renames the referenced code everywhere in the tree (CA-03)', () => {
    expect(
      renameInCondition(
        {
          all: [
            { question: 'P01', op: 'eq', value: '1' },
            { any: [{ question: 'P02', op: 'answered' }] },
            { not: { question: 'P01', op: 'answered' } },
          ],
        },
        'P01',
        'P01_VOTA',
      ),
    ).toEqual({
      all: [
        { question: 'P01_VOTA', op: 'eq', value: '1' },
        { any: [{ question: 'P02', op: 'answered' }] },
        { not: { question: 'P01_VOTA', op: 'answered' } },
      ],
    });
  });
});
