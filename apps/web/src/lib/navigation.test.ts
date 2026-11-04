import { describe, expect, it } from 'vitest';

import { navigationFor, requiredPermission } from './navigation';

describe('navigationFor (spec 007, rule 12)', () => {
  it('shows Usuários to the admin', () => {
    expect(navigationFor('admin').map((i) => i.href)).toEqual(['/', '/usuarios', '/minha-conta']);
  });

  it.each(['coordinator', 'analyst', 'client', 'interviewer'] as const)(
    'hides Usuários from %s',
    (role) => {
      expect(navigationFor(role).map((i) => i.href)).toEqual(['/', '/minha-conta']);
    },
  );

  it('maps a page to the permission it requires', () => {
    expect(requiredPermission('/usuarios')).toBe('users.manage');
    expect(requiredPermission('/usuarios/abc')).toBe('users.manage');
    expect(requiredPermission('/')).toBeUndefined();
    expect(requiredPermission('/minha-conta')).toBeUndefined();
  });
});
