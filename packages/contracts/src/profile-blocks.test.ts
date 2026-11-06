import { describe, expect, it } from 'vitest';

import { buildProfileBlock, PROFILE_BLOCKS, PROFILE_TEMPLATES } from './profile-blocks.js';
import { PROFILE_KEYS, QuestionnaireSnapshot } from './questionnaire.js';
import { draftToSnapshotInput, lintQuestionnaire } from './questionnaire-draft.js';
import type { DraftQuestion } from './questionnaire-draft.js';

const ids = () => {
  let n = 0;
  return () => {
    n += 1;
    return `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
  };
};

const META = {
  surveyId: '0193a000-0000-7000-8000-00000000aaaa',
  versionId: '0193a000-0000-7000-8000-00000000bbbb',
  versionNumber: 1,
  title: 'Pesquisa',
  settings: { gps: 'off' as const, audio: 'off' as const, minDurationSec: 0 },
};

describe('profile blocks (spec 014, change 1)', () => {
  it('has a template for every profile variable, and the full block has them all', () => {
    expect(Object.keys(PROFILE_TEMPLATES).sort()).toEqual([...PROFILE_KEYS].sort());
    expect([...PROFILE_BLOCKS.full].sort()).toEqual([...PROFILE_KEYS].sort());
    expect(PROFILE_BLOCKS.basic).toEqual(['sex', 'age_group', 'education']);
  });

  it('uses the TSE age groups', () => {
    expect(PROFILE_TEMPLATES.age_group.options.map(([, label]) => label)).toEqual([
      '16 a 24 anos',
      '25 a 34 anos',
      '35 a 44 anos',
      '45 a 59 anos',
      '60 anos ou mais',
    ]);
  });

  it('builds a publishable block that becomes a valid snapshot', () => {
    const questions = buildProfileBlock('full', [], ids());
    expect(questions.map((q) => q.code)).toEqual([
      'SEXO',
      'FAIXA_ETARIA',
      'ESCOLARIDADE',
      'RENDA_FAMILIAR',
      'RELIGIAO',
      'OCUPACAO',
      'ZONA',
    ]);
    const draft = { introText: null, questions };
    expect(lintQuestionnaire(draft)).toEqual([]);
    const snapshot = QuestionnaireSnapshot.parse(draftToSnapshotInput(draft, META));
    expect(snapshot.questions.map((q) => q.profile)).toEqual([...PROFILE_BLOCKS.full]);
  });

  it('skips variables already present and avoids code collisions', () => {
    const newId = ids();
    const [sex] = buildProfileBlock('basic', [], newId);
    if (!sex) {
      throw new Error('fixture');
    }
    const taken: DraftQuestion = {
      id: newId(),
      code: 'ESCOLARIDADE',
      text: 'Outra pergunta com este código',
      required: false,
      type: 'text',
      multiline: false,
      maxLength: 100,
    };
    const added = buildProfileBlock('basic', [sex, taken], newId);
    expect(added.map((q) => [q.profile, q.code])).toEqual([
      ['age_group', 'FAIXA_ETARIA'],
      ['education', 'ESCOLARIDADE_2'],
    ]);
    expect(buildProfileBlock('basic', [sex, ...added], newId)).toEqual([]);
  });

  it('flags a profile variable used twice', () => {
    const questions = [
      ...buildProfileBlock('basic', [], ids()),
      ...buildProfileBlock('basic', [], ids()),
    ];
    const renamed = questions.map((q, i) =>
      i >= 3 ? { ...q, id: `${q.id.slice(0, -1)}f`, code: `${q.code}_B` } : q,
    );
    expect(lintQuestionnaire({ introText: null, questions: renamed }).map((i) => i.code)).toEqual([
      'PROFILE_REPEATED',
      'PROFILE_REPEATED',
      'PROFILE_REPEATED',
    ]);
  });

  it('the snapshot itself refuses a profile variable used twice', () => {
    const [first, second] = buildProfileBlock('basic', [], ids());
    if (!first || !second) {
      throw new Error('fixture');
    }
    const draft = { introText: null, questions: [first, { ...second, profile: 'sex' as const }] };
    const parsed = QuestionnaireSnapshot.safeParse(draftToSnapshotInput(draft, META));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.path)).toEqual([['questions', 1, 'profile']]);
  });
});
