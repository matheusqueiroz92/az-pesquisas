import { describe, expect, it } from 'vitest';

import { CreateUserRequest, UpdateUserRequest } from './users.js';

describe('CreateUserRequest', () => {
  const valid = {
    name: '  Lucas Queiroz ',
    email: 'Lucas@AZ.com.br',
    role: 'coordinator',
    password: 'senha-forte-123',
  };

  it('trims the name and normalizes the e-mail', () => {
    expect(CreateUserRequest.parse(valid)).toEqual({
      name: 'Lucas Queiroz',
      email: 'lucas@az.com.br',
      role: 'coordinator',
      password: 'senha-forte-123',
    });
  });

  it.each([
    ['unknown role', { ...valid, role: 'superuser' }],
    ['short password', { ...valid, password: 'curta' }],
    ['one-letter name', { ...valid, name: ' L ' }],
    ['organizationId sent by the client (AGENTS.md rule 5)', { ...valid, organizationId: 'x' }],
  ])('rejects %s', (_case, input) => {
    expect(CreateUserRequest.safeParse(input).success).toBe(false);
  });
});

describe('UpdateUserRequest', () => {
  it('accepts any subset of name, role and status', () => {
    expect(UpdateUserRequest.parse({ status: 'disabled' })).toEqual({ status: 'disabled' });
    expect(UpdateUserRequest.parse({ name: 'Novo Nome', role: 'analyst' })).toEqual({
      name: 'Novo Nome',
      role: 'analyst',
    });
  });

  it('rejects an empty update and unknown fields', () => {
    expect(UpdateUserRequest.safeParse({}).success).toBe(false);
    expect(UpdateUserRequest.safeParse({ email: 'novo@az.com' }).success).toBe(false);
  });
});
