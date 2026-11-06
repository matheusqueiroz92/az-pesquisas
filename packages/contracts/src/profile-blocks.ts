import type { ProfileKey } from './questionnaire.js';
import type { DraftOption, DraftQuestion } from './questionnaire-draft.js';

/**
 * Ready-made respondent profile blocks (spec 014, change 1). The texts and the
 * option codes are the company standard: keeping the codes makes weighting by
 * population data and comparisons across surveys automatic (spec 018). Once
 * inserted, the questions are ordinary editable questions.
 */

type OptionTemplate = readonly [code: string, label: string, flags?: Partial<DraftOption>];

interface ProfileTemplate {
  readonly code: string;
  readonly text: string;
  readonly helpText?: string;
  readonly options: readonly OptionTemplate[];
}

const NS_NR: OptionTemplate = ['NS_NR', 'Não sabe / não respondeu', { fixed: true }];

export const PROFILE_TEMPLATES: Readonly<Record<ProfileKey, ProfileTemplate>> = {
  sex: {
    code: 'SEXO',
    text: 'Sexo do(a) entrevistado(a)',
    helpText: 'Registrar sem perguntar, quando possível.',
    options: [
      ['1', 'Masculino'],
      ['2', 'Feminino'],
    ],
  },
  age_group: {
    code: 'FAIXA_ETARIA',
    text: 'Qual a sua idade?',
    helpText: 'Marcar a faixa da idade informada.',
    options: [
      ['1', '16 a 24 anos'],
      ['2', '25 a 34 anos'],
      ['3', '35 a 44 anos'],
      ['4', '45 a 59 anos'],
      ['5', '60 anos ou mais'],
    ],
  },
  education: {
    code: 'ESCOLARIDADE',
    text: 'Até que série o(a) sr.(a) estudou?',
    options: [
      ['1', 'Não alfabetizado(a) / lê e escreve'],
      ['2', 'Fundamental incompleto'],
      ['3', 'Fundamental completo'],
      ['4', 'Médio incompleto'],
      ['5', 'Médio completo'],
      ['6', 'Superior incompleto'],
      ['7', 'Superior completo ou mais'],
    ],
  },
  family_income: {
    code: 'RENDA_FAMILIAR',
    text: 'Somando a renda de todas as pessoas que moram na sua casa, qual é a renda familiar mensal?',
    helpText: 'Usar o salário mínimo vigente como referência.',
    options: [
      ['1', 'Até 1 salário mínimo'],
      ['2', 'Mais de 1 a 2 salários mínimos'],
      ['3', 'Mais de 2 a 5 salários mínimos'],
      ['4', 'Mais de 5 a 10 salários mínimos'],
      ['5', 'Mais de 10 salários mínimos'],
      NS_NR,
    ],
  },
  religion: {
    code: 'RELIGIAO',
    text: 'Qual é a sua religião?',
    options: [
      ['1', 'Católica'],
      ['2', 'Evangélica'],
      ['3', 'Espírita'],
      ['4', 'Religiões de matriz africana'],
      ['5', 'Outra', { other: true }],
      ['6', 'Sem religião'],
      NS_NR,
    ],
  },
  occupation: {
    code: 'OCUPACAO',
    text: 'Qual é a sua ocupação principal?',
    options: [
      ['1', 'Assalariado(a) com carteira assinada'],
      ['2', 'Assalariado(a) sem carteira assinada'],
      ['3', 'Servidor(a) público(a)'],
      ['4', 'Autônomo(a) / conta própria'],
      ['5', 'Empresário(a) / empregador(a)'],
      ['6', 'Desempregado(a)'],
      ['7', 'Estudante'],
      ['8', 'Aposentado(a) / pensionista'],
      ['9', 'Dona(o) de casa'],
      ['10', 'Outra', { other: true }],
    ],
  },
  area: {
    code: 'ZONA',
    text: 'Zona de residência',
    helpText: 'Preenchido pelo pesquisador conforme o local da entrevista.',
    options: [
      ['1', 'Urbana'],
      ['2', 'Rural'],
    ],
  },
};

export const PROFILE_BLOCKS = {
  basic: ['sex', 'age_group', 'education'],
  full: ['sex', 'age_group', 'education', 'family_income', 'religion', 'occupation', 'area'],
} as const satisfies Record<string, readonly ProfileKey[]>;
export type ProfileBlock = keyof typeof PROFILE_BLOCKS;

/**
 * The questions of a block that the questionnaire does not have yet (by
 * profile variable), with new ids and codes that do not collide.
 */
export const buildProfileBlock = (
  block: ProfileBlock,
  existing: readonly DraftQuestion[],
  newId: () => string,
): DraftQuestion[] => {
  const present = new Set(existing.flatMap((q) => (q.profile ? [q.profile] : [])));
  const codes = new Set(existing.map((q) => q.code));
  const freeCode = (base: string) => {
    let code = base;
    for (let n = 2; codes.has(code); n += 1) {
      code = `${base}_${String(n)}`;
    }
    codes.add(code);
    return code;
  };
  return PROFILE_BLOCKS[block]
    .filter((key) => !present.has(key))
    .map((key): DraftQuestion => {
      const template = PROFILE_TEMPLATES[key];
      return {
        id: newId(),
        code: freeCode(template.code),
        text: template.text,
        ...(template.helpText ? { helpText: template.helpText } : {}),
        required: true,
        profile: key,
        type: 'single_choice',
        shuffleOptions: false,
        options: template.options.map(([code, label, flags]) => ({
          id: newId(),
          code,
          label,
          ...flags,
        })),
      };
    });
};
