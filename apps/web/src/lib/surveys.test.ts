import type { SurveySummary } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import { filterSurveys, foldText, param } from './surveys';

const survey = (title: string, status: SurveySummary['status']): SurveySummary => ({
  id: '0193a000-0000-7000-8000-000000000001',
  title,
  type: 'market',
  status,
  clientId: null,
  clientName: null,
  fieldStart: null,
  fieldEnd: null,
  targetInterviews: null,
  municipalityCount: 0,
  updatedAt: '2026-11-05T12:00:00.000Z',
});

const ITEMS = [
  survey('Avaliação de Itapetinga', 'draft'),
  survey('Intenção de voto Itambé', 'archived'),
  survey('Satisfação do cliente', 'in_field'),
];

describe('filterSurveys', () => {
  it('hides archived surveys by default and shows only them on request', () => {
    expect(filterSurveys(ITEMS, { query: '', archived: false }).map((s) => s.title)).toEqual([
      'Avaliação de Itapetinga',
      'Satisfação do cliente',
    ]);
    expect(filterSurveys(ITEMS, { query: '', archived: true }).map((s) => s.title)).toEqual([
      'Intenção de voto Itambé',
    ]);
  });

  it('searches ignoring case and accents', () => {
    expect(filterSurveys(ITEMS, { query: ' AVALIACAO ', archived: false })).toHaveLength(1);
    expect(filterSurveys(ITEMS, { query: 'itambe', archived: false })).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('folds text', () => {
    expect(foldText('  Câmara de Itambé ')).toBe('camara de itambe');
  });

  it('reads the first value of a search param', () => {
    expect(param(['a', 'b'])).toBe('a');
    expect(param(undefined)).toBe('');
    expect(param('x')).toBe('x');
  });
});
