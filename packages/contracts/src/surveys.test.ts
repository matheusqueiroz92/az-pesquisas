import { describe, expect, it } from 'vitest';

import { BAHIA_MUNICIPALITIES, isBahiaMunicipality } from './municipalities-ba.js';
import {
  CreateClientRequest,
  CreateSurveyRequest,
  isValidTaxId,
  TaxId,
  UpdateClientRequest,
  UpdateSurveyRequest,
} from './surveys.js';

describe('TaxId', () => {
  it.each([
    ['CNPJ with mask', '11.222.333/0001-81', '11222333000181'],
    ['CNPJ digits', '11222333000181', '11222333000181'],
    ['CPF with mask', '529.982.247-25', '52998224725'],
  ])('accepts a %s and keeps only digits', (_case, input, expected) => {
    expect(TaxId.parse(input)).toBe(expected);
  });

  it.each([
    ['wrong CNPJ check digit', '11.222.333/0001-82'],
    ['wrong CPF check digit', '529.982.247-24'],
    ['repeated digits', '111.111.111-11'],
    ['wrong length', '1234567890'],
    ['letters', '52998224A25'],
  ])('rejects a %s', (_case, input) => {
    expect(TaxId.safeParse(input).success).toBe(false);
  });

  it('isValidTaxId works on digits only', () => {
    expect(isValidTaxId('52998224725')).toBe(true);
    expect(isValidTaxId('00000000000000')).toBe(false);
  });
});

describe('Bahia municipalities', () => {
  it('has the 417 municipalities with unique 7-digit IBGE codes of Bahia (29)', () => {
    expect(BAHIA_MUNICIPALITIES).toHaveLength(417);
    const codes = new Set(BAHIA_MUNICIPALITIES.map((m) => m.code));
    expect(codes.size).toBe(417);
    expect([...codes].every((c) => c >= 2900000 && c < 3000000)).toBe(true);
  });

  it('knows Salvador and Itapetinga, not São Paulo', () => {
    expect(isBahiaMunicipality(2927408)).toBe(true);
    expect(isBahiaMunicipality(2916401)).toBe(true);
    expect(isBahiaMunicipality(3550308)).toBe(false);
  });
});

describe('CreateClientRequest', () => {
  it('trims, normalizes and fills optional fields with null', () => {
    expect(CreateClientRequest.parse({ name: ' Prefeitura de Itapetinga ' })).toEqual({
      name: 'Prefeitura de Itapetinga',
      document: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
    });
  });

  it('turns empty strings into null and lower-cases the e-mail', () => {
    expect(
      CreateClientRequest.parse({
        name: 'Cliente',
        document: '',
        contactName: ' ',
        contactEmail: 'Ana@Cliente.COM',
        contactPhone: '(77) 99999-0000',
      }),
    ).toMatchObject({
      document: null,
      contactName: null,
      contactEmail: 'ana@cliente.com',
      contactPhone: '(77) 99999-0000',
    });
  });

  it.each([
    ['invalid document', { name: 'Cliente', document: '11.222.333/0001-82' }],
    ['invalid phone', { name: 'Cliente', contactPhone: 'ligar depois' }],
    ['organizationId (AGENTS.md rule 5)', { name: 'Cliente', organizationId: 'x' }],
  ])('rejects %s', (_case, input) => {
    expect(CreateClientRequest.safeParse(input).success).toBe(false);
  });

  it('update needs at least one field', () => {
    expect(UpdateClientRequest.safeParse({}).success).toBe(false);
    expect(UpdateClientRequest.parse({ contactName: 'Ana' })).toEqual({ contactName: 'Ana' });
  });
});

describe('CreateSurveyRequest', () => {
  const minimal = { title: 'Avaliação da gestão municipal', type: 'municipal_evaluation' };

  it('fills defaults', () => {
    expect(CreateSurveyRequest.parse(minimal)).toEqual({
      ...minimal,
      clientId: null,
      municipalityCodes: [],
      fieldStart: null,
      fieldEnd: null,
      targetInterviews: null,
      settings: { gps: 'optional', audio: 'off', minDurationSec: 0, consentText: null },
      tse: null,
    });
  });

  it('accepts an electoral survey registered at the TSE', () => {
    const parsed = CreateSurveyRequest.parse({
      ...minimal,
      type: 'electoral',
      tse: {
        registrationNumber: 'BA-01234/2026',
        statisticianName: 'Maria Estatística',
        statisticianConre: '1234',
        contractorName: null,
        contractValueCents: 1_250_000,
      },
    });
    expect(parsed.tse?.registrationNumber).toBe('BA-01234/2026');
  });

  it('accepts a registered electoral survey with every TSE field still empty', () => {
    expect(CreateSurveyRequest.parse({ ...minimal, type: 'electoral', tse: {} }).tse).toEqual({
      registrationNumber: null,
      statisticianName: null,
      statisticianConre: null,
      contractorName: null,
      contractValueCents: null,
    });
  });

  it.each([
    ['TSE data on a non-electoral survey', { ...minimal, tse: {} }],
    ['malformed TSE number', { ...minimal, type: 'electoral', tse: { registrationNumber: '123' } }],
    ['negative contract value', { ...minimal, type: 'electoral', tse: { contractValueCents: -1 } }],
    ['field end before start', { ...minimal, fieldStart: '2026-11-20', fieldEnd: '2026-11-10' }],
    ['municipality outside Bahia', { ...minimal, municipalityCodes: [3550308] }],
    ['repeated municipality', { ...minimal, municipalityCodes: [2916401, 2916401] }],
    ['zero target', { ...minimal, targetInterviews: 0 }],
    ['unknown type', { ...minimal, type: 'census' }],
    ['short title', { ...minimal, title: 'AB' }],
    [
      'minimum duration above 2 hours',
      { ...minimal, settings: { gps: 'off', audio: 'off', minDurationSec: 7201 } },
    ],
    ['status sent by the client', { ...minimal, status: 'in_field' }],
  ])('rejects %s', (_case, input) => {
    expect(CreateSurveyRequest.safeParse(input).success).toBe(false);
  });
});

describe('UpdateSurveyRequest', () => {
  it('accepts a partial change', () => {
    expect(UpdateSurveyRequest.parse({ targetInterviews: 800 })).toEqual({ targetInterviews: 800 });
  });

  it.each([
    ['nothing to update', {}],
    ['TSE data with a non-electoral type', { type: 'market', tse: {} }],
    ['field end before start', { fieldStart: '2026-11-20', fieldEnd: '2026-11-10' }],
  ])('rejects %s', (_case, input) => {
    expect(UpdateSurveyRequest.safeParse(input).success).toBe(false);
  });
});
