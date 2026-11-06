import { ERROR_CODES, ROLES } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import { errorMessage, t } from './pt-BR';

describe('pt-BR texts (rule 13)', () => {
  it.each(ERROR_CODES)('translates the API error code %s', (code) => {
    const message = errorMessage(code);

    expect(message).not.toBe(code);
    expect(message.length).toBeGreaterThan(5);
  });

  it('falls back to a generic message for codes it does not know', () => {
    expect(errorMessage('SOMETHING_NEW')).toBe(t.errors.generic);
    expect(errorMessage(undefined)).toBe(t.errors.generic);
  });

  it.each(ROLES)('has a label for the role %s', (role) => {
    expect(t.roles[role]).toMatch(/^[A-ZÁ-Ú]/);
  });

  it('keeps the login error generic, with the lockout hint (spec 005 rule 8)', () => {
    expect(errorMessage('INVALID_CREDENTIALS')).toContain('E-mail ou senha incorretos');
    expect(t.login.lockoutHint).toContain('15 minutos');
  });
});

describe('t.home.greeting', () => {
  it('greets by first name', () => {
    expect(t.home.greeting('Ana Maria Souza')).toBe('Olá, Ana!');
  });
});

describe('plural and template texts (spec 013)', () => {
  it.each([
    [t.clients.count, 'cliente', 'clientes'],
    [t.surveys.count, 'pesquisa', 'pesquisas'],
    [t.surveys.municipalityCount, '1 município', '3 municípios'],
  ])('pluralizes', (fn, one, many) => {
    expect(fn(1)).toBe(one);
    expect(fn(3)).toBe(many);
  });

  it('counts chosen municipalities and names things', () => {
    expect(t.surveys.fields.municipalitySelected(0)).toBe('Nenhum município escolhido');
    expect(t.surveys.fields.municipalitySelected(1)).toBe('1 escolhido');
    expect(t.surveys.fields.municipalitySelected(4)).toBe('4 escolhidos');
    expect(t.surveys.fields.municipalityRemove('Itambé')).toBe('Remover Itambé');
    expect(t.clients.deleteTitle('Cliente X')).toBe('Excluir Cliente X?');
  });

  it('has labels for every survey type, status and collection mode', () => {
    expect(Object.values(t.surveyTypes)).toHaveLength(5);
    expect(Object.values(t.surveyStatuses)).toHaveLength(4);
    expect(t.gpsModes.required).toBe('Obrigatório');
    expect(t.audioModes.on).toBe('Ligada');
  });
});
