import {
  buildProfileBlock,
  lintQuestionnaire,
  QUESTION_TYPES,
  QuestionnaireDraft,
} from '@az-pesquisas/contracts';
import type { DraftQuestion } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import {
  comparisonFor,
  editorReducer,
  fromEditable,
  newQuestion,
  nextItemCode,
  nextQuestionCode,
  operatorsFor,
  toEditable,
} from './questionnaire-editor';

const ids = (start = 0) => {
  let n = start;
  return () => {
    n += 1;
    return `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  };
};

const EMPTY: QuestionnaireDraft = { introText: null, questions: [] };

const build = (...types: DraftQuestion['type'][]) => {
  const newId = ids();
  return types.reduce<QuestionnaireDraft>(
    (draft, type) =>
      editorReducer(draft, {
        type: 'insert',
        question: newQuestion(type, nextQuestionCode(draft.questions), newId),
        index: draft.questions.length,
      }),
    EMPTY,
  );
};

const at = (draft: QuestionnaireDraft, i: number): DraftQuestion => {
  const q = draft.questions[i];
  if (!q) {
    throw new Error(`no question ${String(i)}`);
  }
  return q;
};

describe('creation', () => {
  it('suggests the first free code', () => {
    expect(nextQuestionCode([])).toBe('P01');
    const draft = build('text', 'text', 'text');
    expect(draft.questions.map((q) => q.code)).toEqual(['P01', 'P02', 'P03']);
    const withoutSecond = editorReducer(draft, { type: 'remove', id: at(draft, 1).id });
    expect(nextQuestionCode(withoutSecond.questions)).toBe('P02');
    expect(nextItemCode([{ code: '1' }, { code: '3' }])).toBe('2');
  });

  it('creates every type as a valid draft question', () => {
    const newId = ids();
    for (const type of QUESTION_TYPES) {
      const draft = { introText: null, questions: [newQuestion(type, 'P01', newId)] };
      expect(QuestionnaireDraft.safeParse(draft).success, type).toBe(true);
    }
  });

  it('becomes publishable once texts and labels are filled', () => {
    let draft = build('single_choice', 'scale');
    const choice = at(draft, 0);
    draft = editorReducer(draft, { type: 'update', id: choice.id, patch: { text: 'Vota?' } });
    draft = editorReducer(draft, { type: 'update', id: at(draft, 1).id, patch: { text: 'Nota' } });
    expect(lintQuestionnaire(draft).map((i) => i.code)).toEqual([
      'ITEM_LABEL_EMPTY',
      'ITEM_LABEL_EMPTY',
    ]);
    for (const [index, label] of ['Sim', 'Não'].entries()) {
      draft = editorReducer(draft, {
        type: 'updateItem',
        id: choice.id,
        list: 'options',
        index,
        patch: { label },
      });
    }
    expect(lintQuestionnaire(draft)).toEqual([]);
  });
});

describe('profile blocks (spec 014, change 1)', () => {
  it('inserts a block at the start, keeping what was there', () => {
    const draft = build('text');
    const block = buildProfileBlock('basic', draft.questions, ids(1000));
    const next = editorReducer(draft, { type: 'insertMany', questions: block, index: 0 });
    expect(next.questions.map((q) => q.code)).toEqual([
      'SEXO',
      'FAIXA_ETARIA',
      'ESCOLARIDADE',
      'P01',
    ]);
  });
});

describe('editing', () => {
  it('moves questions and keeps their ids (CA-02)', () => {
    const draft = build('text', 'number', 'date');
    const last = at(draft, 2);
    const moved = editorReducer(draft, { type: 'move', id: last.id, to: 0 });
    expect(moved.questions.map((q) => q.id)).toEqual([last.id, at(draft, 0).id, at(draft, 1).id]);
    expect(editorReducer(draft, { type: 'move', id: 'nope', to: 0 })).toBe(draft);
  });

  it('renames the code in the conditions that cite it (CA-03)', () => {
    let draft = build('single_choice', 'text');
    const [p1, p2] = [at(draft, 0), at(draft, 1)];
    draft = editorReducer(draft, {
      type: 'setCondition',
      id: p2.id,
      condition: { question: 'P01', op: 'eq', value: '1' },
    });
    draft = editorReducer(draft, { type: 'update', id: p1.id, patch: { code: 'P01_VOTA' } });
    expect(at(draft, 1).visibleIf).toEqual({ question: 'P01_VOTA', op: 'eq', value: '1' });
    draft = editorReducer(draft, { type: 'setCondition', id: p2.id, condition: undefined });
    expect('visibleIf' in at(draft, 1)).toBe(false);
    expect(editorReducer(draft, { type: 'update', id: 'nope', patch: { text: 'x' } })).toBe(draft);
  });

  it('drops optional fields set to undefined', () => {
    let draft = build('number');
    const q = at(draft, 0);
    draft = editorReducer(draft, { type: 'update', id: q.id, patch: { min: 1, unit: 'anos' } });
    draft = editorReducer(draft, { type: 'update', id: q.id, patch: { min: undefined } });
    expect('min' in at(draft, 0)).toBe(false);
    expect(at(draft, 0)).toMatchObject({ unit: 'anos' });
  });

  it('duplicates a question with new ids and a free code', () => {
    const newId = ids(1000);
    let draft = build('matrix', 'text');
    draft = editorReducer(draft, { type: 'duplicate', id: at(draft, 0).id, newId });
    const [original, copy] = [at(draft, 0), at(draft, 1)];
    expect(copy.code).toBe('P03');
    expect(copy.id).not.toBe(original.id);
    if (copy.type !== 'matrix' || original.type !== 'matrix') {
      throw new Error('fixture');
    }
    expect(copy.rows[0]?.id).not.toBe(original.rows[0]?.id);
    expect(copy.options[0]?.id).not.toBe(original.options[0]?.id);
    expect(editorReducer(draft, { type: 'duplicate', id: 'nope', newId })).toBe(draft);
  });

  it('adds, edits, moves and removes options and rows', () => {
    const newId = ids(1000);
    let draft = build('matrix');
    const q = at(draft, 0);
    draft = editorReducer(draft, {
      type: 'addItem',
      id: q.id,
      list: 'rows',
      item: { id: newId(), code: '2', label: 'Educação' },
    });
    draft = editorReducer(draft, {
      type: 'updateItem',
      id: q.id,
      list: 'options',
      index: 0,
      patch: { label: 'Bom', fixed: true },
    });
    draft = editorReducer(draft, { type: 'moveItem', id: q.id, list: 'rows', from: 1, to: 0 });
    draft = editorReducer(draft, { type: 'removeItem', id: q.id, list: 'options', index: 1 });
    const m = at(draft, 0);
    if (m.type !== 'matrix') {
      throw new Error('fixture');
    }
    expect(m.rows.map((r) => r.label)).toEqual(['Educação', '']);
    expect(m.options).toEqual([expect.objectContaining({ label: 'Bom', fixed: true })]);
  });

  it('ignores item edits on questions without that list', () => {
    const draft = build('text');
    const id = at(draft, 0).id;
    for (const action of [
      { type: 'addItem', id, list: 'options', item: { id: 'x', code: '1', label: '' } },
      { type: 'updateItem', id, list: 'rows', index: 0, patch: { label: 'x' } },
      { type: 'removeItem', id, list: 'options', index: 0 },
      { type: 'moveItem', id, list: 'options', from: 0, to: 1 },
    ] as const) {
      expect(editorReducer(draft, action)).toEqual(draft);
    }
  });

  it('sets the opening text, empty becomes null', () => {
    expect(editorReducer(EMPTY, { type: 'setIntro', text: 'Bom dia' }).introText).toBe('Bom dia');
    expect(editorReducer(EMPTY, { type: 'setIntro', text: '' }).introText).toBeNull();
  });
});

describe('conditions', () => {
  it('round-trips one level of comparisons', () => {
    const a = { question: 'P01', op: 'answered' as const };
    const b = { question: 'P02', op: 'gt' as const, value: 3 };
    expect(toEditable(undefined)).toEqual({ mode: 'all', comparisons: [] });
    expect(toEditable(a)).toEqual({ mode: 'all', comparisons: [a] });
    expect(toEditable({ any: [a, b] })).toEqual({ mode: 'any', comparisons: [a, b] });
    expect(fromEditable({ mode: 'all', comparisons: [] })).toBeUndefined();
    expect(fromEditable({ mode: 'any', comparisons: [a] })).toEqual(a);
    expect(fromEditable({ mode: 'all', comparisons: [a, b] })).toEqual({ all: [a, b] });
    expect(fromEditable({ mode: 'any', comparisons: [a, b] })).toEqual({ any: [a, b] });
  });

  it('does not flatten nested conditions it cannot show', () => {
    const a = { question: 'P01', op: 'answered' as const };
    expect(toEditable({ not: a })).toBeNull();
    expect(toEditable({ all: [{ any: [a] }] })).toBeNull();
    expect(toEditable({ any: [{ not: a }] })).toBeNull();
  });

  it('offers the operators that fit the referenced question', () => {
    expect(operatorsFor('single_choice')).toContain('in');
    expect(operatorsFor('scale')).toContain('gte');
    expect(operatorsFor('text')).toEqual(['answered', 'notAnswered']);
  });

  it('builds comparisons with a fitting default value', () => {
    const draft = build('single_choice', 'scale', 'text');
    const [choice, scale, text] = [at(draft, 0), at(draft, 1), at(draft, 2)];
    expect(comparisonFor(choice, 'eq')).toEqual({ question: 'P01', op: 'eq', value: '1' });
    expect(comparisonFor(choice, 'in')).toEqual({ question: 'P01', op: 'in', value: ['1'] });
    expect(comparisonFor(scale, 'gte')).toEqual({ question: 'P02', op: 'gte', value: 0 });
    expect(comparisonFor(text, 'answered')).toEqual({ question: 'P03', op: 'answered' });
    const number = newQuestion('number', 'P09', ids());
    expect(comparisonFor(number, 'lt')).toEqual({ question: 'P09', op: 'lt', value: 0 });
  });
});
