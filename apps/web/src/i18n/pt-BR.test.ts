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
