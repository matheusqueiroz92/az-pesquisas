import { describe, expect, it } from 'vitest';

import { QuestionnaireSnapshot } from './questionnaire.js';
import { fixture } from './test-fixtures.js';

type Json = Record<string, unknown>;

/** The example questionnaire, as a mutable object. */
const snapshot = () => fixture('questionnaire-snapshot');
const questions = (s: Json) => s['questions'] as Json[];
const question = (s: Json, code: string): Json => {
  const found = questions(s).find((q) => q['code'] === code);
  if (!found) {
    throw new Error(`no question ${code} in the fixture`);
  }
  return found;
};

/** Issue paths of a rejected snapshot, as dotted strings. */
const rejectionPaths = (s: Json): string[] => {
  const result = QuestionnaireSnapshot.safeParse(s);
  expect(result.success, 'expected the snapshot to be rejected').toBe(false);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('QuestionnaireSnapshot structure (CA-02)', () => {
  it('accepts the example with all ten question types', () => {
    const parsed = QuestionnaireSnapshot.parse(snapshot());

    expect(parsed.questions.map((q) => q.type)).toEqual([
      'single_choice',
      'number',
      'text',
      'scale',
      'multiple_choice',
      'matrix',
      'single_choice',
      'ranking',
      'date',
      'photo',
      'signature',
    ]);
  });

  it('rejects a repeated question code', () => {
    const s = snapshot();
    question(s, 'P03_BAIRRO')['code'] = 'P01_SEXO';

    expect(rejectionPaths(s)).toContain('questions.2.code');
  });

  it('rejects a repeated question id', () => {
    const s = snapshot();
    question(s, 'P03_BAIRRO')['id'] = question(s, 'P01_SEXO')['id'];

    expect(rejectionPaths(s)).toContain('questions.2.id');
  });

  it.each([['p01_sexo'], ['1ABC'], ['P01 SEXO'], ['P'.repeat(41)]])(
    'rejects the question code %j',
    (code) => {
      const s = snapshot();
      question(s, 'P01_SEXO')['code'] = code;

      expect(rejectionPaths(s)).toContain('questions.0.code');
    },
  );

  it('rejects a repeated option code inside a question', () => {
    const s = snapshot();
    const options = question(s, 'P01_SEXO')['options'] as Json[];
    options[1]!['code'] = '1';

    expect(rejectionPaths(s)).toContain('questions.0.options.1.code');
  });

  it('rejects two "other" options in the same question', () => {
    const s = snapshot();
    const options = question(s, 'P05_AREAS')['options'] as Json[];
    options[0]!['other'] = true;

    expect(rejectionPaths(s)).toContain('questions.4.options');
  });

  it('rejects minSelections above maxSelections, and maxSelections above the option count', () => {
    const s1 = snapshot();
    Object.assign(question(s1, 'P05_AREAS'), { minSelections: 3, maxSelections: 2 });
    const s2 = snapshot();
    Object.assign(question(s2, 'P05_AREAS'), { maxSelections: 6 });

    expect(rejectionPaths(s1)).toContain('questions.4.minSelections');
    expect(rejectionPaths(s2)).toContain('questions.4.maxSelections');
  });

  it('rejects an inverted or too long scale', () => {
    const s1 = snapshot();
    Object.assign(question(s1, 'P04_AVALIACAO'), { min: 10, max: 0 });
    const s2 = snapshot();
    Object.assign(question(s2, 'P04_AVALIACAO'), { min: 0, max: 101 });

    expect(rejectionPaths(s1)).toContain('questions.3.max');
    expect(rejectionPaths(s2)).toContain('questions.3.max');
  });

  it('rejects number and date ranges with min above max', () => {
    const s1 = snapshot();
    Object.assign(question(s1, 'P02_IDADE'), { min: 120, max: 16 });
    const s2 = snapshot();
    Object.assign(question(s2, 'P09_NASCIMENTO'), { min: '2010-12-31', max: '1900-01-01' });

    expect(rejectionPaths(s1)).toContain('questions.1.max');
    expect(rejectionPaths(s2)).toContain('questions.8.max');
  });

  it('rejects a matrix with a repeated row code and a ranking with maxRanked above options', () => {
    const s1 = snapshot();
    const rows = question(s1, 'P06_SERVICOS')['rows'] as Json[];
    rows[1]!['code'] = 'SAUDE';
    const s2 = snapshot();
    question(s2, 'P08_PRIORIDADES')['maxRanked'] = 5;

    expect(rejectionPaths(s1)).toContain('questions.5.rows.1.code');
    expect(rejectionPaths(s2)).toContain('questions.7.maxRanked');
  });

  it('rejects a single choice with fewer than 2 options and an unknown question type', () => {
    const s1 = snapshot();
    const q = question(s1, 'P01_SEXO');
    q['options'] = (q['options'] as Json[]).slice(0, 1);
    const s2 = snapshot();
    question(s2, 'P03_BAIRRO')['type'] = 'audio_question';

    expect(rejectionPaths(s1)).toContain('questions.0.options');
    expect(rejectionPaths(s2).some((p) => p.startsWith('questions.2'))).toBe(true);
  });

  it('rejects an unknown schemaVersion and an empty questionnaire', () => {
    const s1 = snapshot();
    s1['schemaVersion'] = 2;
    const s2 = snapshot();
    s2['questions'] = [];

    expect(rejectionPaths(s1)).toContain('schemaVersion');
    expect(rejectionPaths(s2)).toContain('questions');
  });

  it('ignores unknown fields sent by a newer server (tolerant on what the app receives)', () => {
    const s = snapshot();
    s['futureField'] = 'x';
    question(s, 'P01_SEXO')['futureConfig'] = { a: 1 };

    const parsed = QuestionnaireSnapshot.parse(s);

    expect(parsed).not.toHaveProperty('futureField');
  });
});

describe('visibleIf (CA-03)', () => {
  const withCondition = (code: string, visibleIf: unknown) => {
    const s = snapshot();
    question(s, code)['visibleIf'] = visibleIf;
    return s;
  };

  it('rejects a reference to a later question (prevents cycles)', () => {
    const s = withCondition('P02_IDADE', { question: 'P07_VOTO', op: 'answered' });

    expect(rejectionPaths(s)).toContain('questions.1.visibleIf.question');
  });

  it('rejects a reference to the question itself', () => {
    expect(
      rejectionPaths(withCondition('P02_IDADE', { question: 'P02_IDADE', op: 'answered' })),
    ).toContain('questions.1.visibleIf.question');
  });

  it('rejects a reference to an unknown code', () => {
    expect(
      rejectionPaths(withCondition('P07_VOTO', { question: 'P99_NADA', op: 'answered' })),
    ).toContain('questions.6.visibleIf.question');
  });

  it('rejects an option code that does not exist in the referenced question', () => {
    const paths = rejectionPaths(
      withCondition('P07_VOTO', { question: 'P01_SEXO', op: 'in', value: ['1', 'X'] }),
    );

    expect(paths).toContain('questions.6.visibleIf.value');
  });

  it.each([
    ['gt on a choice question', { question: 'P01_SEXO', op: 'gt', value: 1 }],
    ['in on a number question', { question: 'P02_IDADE', op: 'in', value: ['30'] }],
    ['eq on a text question', { question: 'P03_BAIRRO', op: 'eq', value: 'Centro' }],
    ['a string value with gte', { question: 'P02_IDADE', op: 'gte', value: '18' }],
    ['answered with a value', { question: 'P01_SEXO', op: 'answered', value: '1' }],
    ['eq with a list', { question: 'P01_SEXO', op: 'eq', value: ['1'] }],
    ['in with an empty list', { question: 'P01_SEXO', op: 'in', value: [] }],
    ['an unknown operator', { question: 'P01_SEXO', op: 'contains', value: '1' }],
  ])('rejects %s', (_case, condition) => {
    expect(rejectionPaths(withCondition('P07_VOTO', condition)).length).toBeGreaterThan(0);
  });

  it.each([
    ['eq with a list', { question: 'P01_SEXO', op: 'eq', value: ['1'] }, 'needs one option code'],
    ['in with a single code', { question: 'P01_SEXO', op: 'in', value: '1' }, 'needs a list'],
  ])('explains %s precisely', (_case, condition, message) => {
    const result = QuestionnaireSnapshot.safeParse(withCondition('P07_VOTO', condition));

    expect(result.error?.issues.map((i) => i.message).join(' ')).toContain(message);
  });

  it('accepts eq on a scale and in on a multiple choice', () => {
    const s = withCondition('P07_VOTO', {
      all: [
        { question: 'P04_AVALIACAO', op: 'eq', value: 10 },
        { question: 'P05_AREAS', op: 'in', value: ['SAUDE', 'OUTRO'] },
      ],
    });

    expect(QuestionnaireSnapshot.safeParse(s).success).toBe(true);
  });

  it('rejects conditions nested deeper than 5 levels', () => {
    let condition: unknown = { question: 'P01_SEXO', op: 'answered' };
    for (let depth = 0; depth < 6; depth += 1) {
      condition = { not: condition };
    }

    expect(rejectionPaths(withCondition('P07_VOTO', condition))).toContain('questions.6.visibleIf');
  });

  it('rejects more than 50 comparisons in one question', () => {
    const many = Array.from({ length: 51 }, () => ({ question: 'P01_SEXO', op: 'answered' }));

    expect(rejectionPaths(withCondition('P07_VOTO', { any: many }))).toContain(
      'questions.6.visibleIf',
    );
  });

  it('rejects an empty all/any group', () => {
    expect(rejectionPaths(withCondition('P07_VOTO', { all: [] })).length).toBeGreaterThan(0);
  });
});
