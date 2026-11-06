import { describe, expect, it } from 'vitest';

import { QuestionnaireSnapshot } from './questionnaire.js';
import {
  affectsComparability,
  compareVersions,
  isIncompatible,
  PublishQuestionnaireRequest,
  QuestionnaireVersionView,
} from './questionnaire-versions.js';

const id = (n: number) => `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`;

const base = () =>
  QuestionnaireSnapshot.parse({
    schemaVersion: 1,
    surveyId: id(900),
    versionId: id(901),
    versionNumber: 1,
    title: 'Pesquisa',
    settings: { gps: 'optional', audio: 'off', minDurationSec: 0 },
    questions: [
      {
        id: id(1),
        code: 'P01',
        text: 'Você vai votar?',
        required: true,
        type: 'single_choice',
        shuffleOptions: false,
        options: [
          { id: id(11), code: '1', label: 'Sim' },
          { id: id(12), code: '2', label: 'Não' },
        ],
      },
      {
        id: id(2),
        code: 'P02',
        text: 'Avalie',
        required: true,
        type: 'matrix',
        rows: [{ id: id(21), code: 'S', label: 'Saúde' }],
        options: [
          { id: id(22), code: '1', label: 'Bom' },
          { id: id(23), code: '2', label: 'Ruim' },
        ],
      },
      { id: id(3), code: 'P03', text: 'Assine', required: false, type: 'signature' },
    ],
  });

const kinds = (a: QuestionnaireSnapshot, b: QuestionnaireSnapshot) =>
  compareVersions(a, b).map((c) => c.kind);

describe('compareVersions', () => {
  it('finds nothing between identical snapshots, even with a new version id', () => {
    expect(compareVersions(base(), { ...base(), versionId: id(902), versionNumber: 2 })).toEqual(
      [],
    );
  });

  it('ignores the order of keys (snapshots come back from JSONB reordered)', () => {
    const v1 = base();
    const reordered = JSON.parse(
      JSON.stringify(v1, (_k, v: unknown) =>
        v !== null && typeof v === 'object' && !Array.isArray(v)
          ? Object.fromEntries(Object.entries(v as Record<string, unknown>).reverse())
          : v,
      ),
    ) as typeof v1;
    expect(compareVersions(v1, reordered)).toEqual([]);
  });

  it('reports survey-level changes', () => {
    const next = {
      ...base(),
      title: 'Outra',
      introText: 'Bom dia',
      settings: { ...base().settings, gps: 'required' as const },
    };
    expect(kinds(base(), next)).toEqual(['title', 'intro', 'settings']);
  });

  it('reports added, removed, renamed and reworded questions and items (CA-03)', () => {
    const v1 = base();
    const [p1, p2] = v1.questions;
    if (p1?.type !== 'single_choice' || p2?.type !== 'matrix') {
      throw new Error('fixture');
    }
    const v2 = {
      ...v1,
      questions: [
        {
          ...p1,
          code: 'P01_VOTA',
          text: 'O(a) sr.(a) vai votar?',
          options: [
            { id: id(11), code: 'S', label: 'Sim' },
            { id: id(12), code: '2', label: 'Não vai' },
            { id: id(13), code: 'NS', label: 'Não sabe' },
          ],
        },
        { ...p2, rows: [], required: false },
        {
          id: id(4),
          code: 'P04',
          text: 'Idade',
          required: true,
          type: 'number' as const,
          integer: true,
        },
      ],
    };
    const changes = compareVersions(v1, v2);
    expect(changes).toEqual([
      {
        kind: 'question_code',
        questionId: id(1),
        questionCode: 'P01_VOTA',
        from: 'P01',
        to: 'P01_VOTA',
      },
      { kind: 'question_text', questionId: id(1), questionCode: 'P01_VOTA' },
      {
        kind: 'item_code',
        questionId: id(1),
        questionCode: 'P01_VOTA',
        list: 'options',
        itemId: id(11),
        itemLabel: 'Sim',
        from: '1',
        to: 'S',
      },
      {
        kind: 'item_text',
        questionId: id(1),
        questionCode: 'P01_VOTA',
        list: 'options',
        itemId: id(12),
        itemLabel: 'Não vai',
      },
      {
        kind: 'item_added',
        questionId: id(1),
        questionCode: 'P01_VOTA',
        list: 'options',
        itemId: id(13),
        itemLabel: 'Não sabe',
      },
      {
        kind: 'item_removed',
        questionId: id(2),
        questionCode: 'P02',
        list: 'rows',
        itemId: id(21),
        itemLabel: 'Saúde',
      },
      { kind: 'question_settings', questionId: id(2), questionCode: 'P02' },
      { kind: 'question_added', questionId: id(4), questionCode: 'P04' },
      { kind: 'question_removed', questionId: id(3), questionCode: 'P03' },
    ]);
    expect(changes.filter(affectsComparability).map((c) => c.kind)).toEqual([
      'question_text',
      'item_added',
      'item_removed',
    ]);
  });

  it('flags a question whose type changed as incompatible', () => {
    const v1 = base();
    const v2 = {
      ...v1,
      questions: v1.questions.map((q) =>
        q.code === 'P03'
          ? {
              id: q.id,
              code: q.code,
              text: q.text,
              required: false,
              type: 'photo' as const,
              maxPhotos: 1,
            }
          : q,
      ),
    };
    const changes = compareVersions(v1, v2);
    expect(changes.map((c) => c.kind)).toEqual(['question_type']);
    expect(changes.some(isIncompatible)).toBe(true);
  });

  it('notices changed option flags as a settings change', () => {
    const v1 = base();
    const v2 = {
      ...v1,
      questions: v1.questions.map((q) =>
        q.type === 'single_choice'
          ? { ...q, options: q.options.map((o, i) => (i === 1 ? { ...o, fixed: true } : o)) }
          : q,
      ),
    };
    expect(kinds(v1, v2)).toEqual(['question_settings']);
  });
});

describe('publication API schemas', () => {
  it('validates requests and views', () => {
    expect(PublishQuestionnaireRequest.safeParse({ revision: 3 }).success).toBe(true);
    expect(PublishQuestionnaireRequest.safeParse({ revision: 3, force: true }).success).toBe(false);
    expect(
      QuestionnaireVersionView.parse({
        id: id(901),
        number: 1,
        publishedAt: '2026-11-06T12:00:00.000Z',
        questionCount: 3,
        changes: [],
        snapshot: base(),
      }).snapshot.questions,
    ).toHaveLength(3);
  });
});
