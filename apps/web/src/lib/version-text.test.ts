import { describe, expect, it } from 'vitest';
import type { Question } from '@az-pesquisas/contracts';

import { describeChange, describeCondition } from './version-text';

const P01: Question = {
  id: '0193a000-0000-7000-8000-000000000001',
  code: 'P01',
  text: 'Vai votar?',
  required: true,
  type: 'single_choice',
  shuffleOptions: false,
  options: [
    { id: '0193a000-0000-7000-8000-000000000002', code: '1', label: 'Sim' },
    { id: '0193a000-0000-7000-8000-000000000003', code: '2', label: 'Não' },
  ],
};

describe('describeChange', () => {
  it.each([
    [{ kind: 'title' }, 'Título da pesquisa alterado'],
    [{ kind: 'question_added', questionCode: 'P04' }, 'P04: pergunta nova'],
    [
      { kind: 'question_code', questionCode: 'P01_V', from: 'P01', to: 'P01_V' },
      'P01_V: código P01 → P01_V',
    ],
    [
      { kind: 'item_added', questionCode: 'P01', itemLabel: 'Não sabe' },
      'P01: opção nova "Não sabe"',
    ],
    [{ kind: 'item_code', questionCode: 'P01', from: '1', to: 'S' }, 'P01: código de opção 1 → S'],
    [{ kind: 'question_removed' }, ': pergunta retirada'],
    [{ kind: 'intro' }, 'Texto de abertura alterado'],
    [
      { kind: 'settings' },
      'Configurações de coleta alteradas (GPS, áudio, duração ou consentimento)',
    ],
    [{ kind: 'question_text', questionCode: 'P1' }, 'P1: enunciado alterado'],
    [{ kind: 'question_settings', questionCode: 'P1' }, 'P1: configuração alterada'],
    [{ kind: 'question_type', questionCode: 'P1' }, 'P1: tipo alterado (não permitido)'],
    [{ kind: 'item_removed', questionCode: 'P1', itemLabel: 'X' }, 'P1: opção retirada "X"'],
    [{ kind: 'item_text', questionCode: 'P1', itemLabel: 'Y' }, 'P1: rótulo alterado para "Y"'],
  ] as const)('%j', (change, text) => {
    expect(describeChange(change)).toBe(text);
  });
});

describe('describeCondition', () => {
  it('writes conditions out with option labels', () => {
    expect(describeCondition({ question: 'P01', op: 'eq', value: '1' }, [P01])).toBe(
      'P01 é igual a 1 (Sim)',
    );
    expect(
      describeCondition(
        {
          all: [
            { question: 'P01', op: 'in', value: ['1', '9'] },
            {
              any: [
                { question: 'P02', op: 'gte', value: 18 },
                { question: 'P03', op: 'answered' },
              ],
            },
            { not: { question: 'P01', op: 'notAnswered' } },
          ],
        },
        [P01],
      ),
    ).toBe(
      'P01 está entre 1 (Sim), 9 e (P02 maior ou igual a 18 ou P03 foi respondida) e não (P01 não foi respondida)',
    );
  });
});
