import { CreateSurveyRequest } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import { centsToInput, formText, surveyBodyFrom } from './survey-form';

const reader =
  (values: Record<string, string>) =>
  (name: string): string =>
    values[name] ?? '';

const BASE = {
  title: 'Intenção de voto',
  clientId: '',
  fieldStart: '2026-11-10',
  fieldEnd: '',
  targetInterviews: '600',
  gps: 'required',
  audio: 'off',
  minDurationMin: '3',
  consentText: '',
  registrationNumber: 'BA-01234/2026',
  statisticianName: 'Maria',
  statisticianConre: '',
  contractorName: '',
  contractValue: '12.500,00',
};

describe('surveyBodyFrom', () => {
  it('builds a body the API contract accepts', () => {
    const result = surveyBodyFrom(reader(BASE), {
      type: 'electoral',
      tseRegistered: true,
      municipalityCodes: [2916401],
    });
    expect(result).toEqual({
      ok: true,
      body: {
        title: 'Intenção de voto',
        type: 'electoral',
        clientId: null,
        municipalityCodes: [2916401],
        fieldStart: '2026-11-10',
        fieldEnd: null,
        targetInterviews: 600,
        settings: { gps: 'required', audio: 'off', minDurationSec: 180, consentText: null },
        tse: {
          registrationNumber: 'BA-01234/2026',
          statisticianName: 'Maria',
          statisticianConre: null,
          contractorName: null,
          contractValueCents: 1_250_000,
        },
      },
    });
    expect(result.ok && CreateSurveyRequest.safeParse(result.body).success).toBe(true);
  });

  it('sends no TSE data when the survey is not registered or not electoral', () => {
    for (const state of [
      { type: 'electoral' as const, tseRegistered: false },
      { type: 'market' as const, tseRegistered: true },
    ]) {
      const result = surveyBodyFrom(reader(BASE), { ...state, municipalityCodes: [] });
      expect(result.ok && result.body['tse']).toBeNull();
    }
  });

  it('points at the contract value when it is not money', () => {
    expect(
      surveyBodyFrom(reader({ ...BASE, contractValue: 'muito' }), {
        type: 'electoral',
        tseRegistered: true,
        municipalityCodes: [],
      }),
    ).toEqual({ ok: false, field: 'tse.contractValueCents' });
  });

  it('keeps blank numbers as null and duration 0', () => {
    const result = surveyBodyFrom(reader({ ...BASE, targetInterviews: '', minDurationMin: '' }), {
      type: 'market',
      tseRegistered: false,
      municipalityCodes: [],
    });
    expect(result.ok && result.body).toMatchObject({
      targetInterviews: null,
      settings: { minDurationSec: 0 },
    });
  });
});

describe('centsToInput', () => {
  it('shows cents as reais for the input', () => {
    expect(centsToInput(1_250_000)).toBe('12.500,00');
    expect(centsToInput(null)).toBe('');
  });
});

describe('formText', () => {
  it('reads trimmed text and ignores files or absent fields', () => {
    const data = new FormData();
    data.set('name', '  Ana ');
    data.set('file', new Blob(['x']));
    expect(formText(data, 'name')).toBe('Ana');
    expect(formText(data, 'file')).toBe('');
    expect(formText(data, 'missing')).toBe('');
  });
});

describe('numbers typed in the form', () => {
  it('sends garbage as is, for the API to point at the field', () => {
    const result = surveyBodyFrom(
      reader({ ...BASE, targetInterviews: 'abc', minDurationMin: 'x' }),
      {
        type: 'market',
        tseRegistered: false,
        municipalityCodes: [],
      },
    );
    expect(result.ok && result.body).toMatchObject({
      targetInterviews: 'abc',
      settings: { minDurationSec: 'x' },
    });
  });
});
