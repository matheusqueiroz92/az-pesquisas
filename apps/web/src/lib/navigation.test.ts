import { describe, expect, it } from 'vitest';

import { navigationFor, requiredPermission } from './navigation';

describe('navigationFor (spec 007, rule 12)', () => {
  it('shows everything to the admin', () => {
    expect(navigationFor('admin').map((i) => i.href)).toEqual([
      '/',
      '/pesquisas',
      '/clientes',
      '/usuarios',
      '/minha-conta',
    ]);
  });

  it('shows Pesquisas and Clientes, not Usuários, to the coordinator (spec 013)', () => {
    expect(navigationFor('coordinator').map((i) => i.href)).toEqual([
      '/',
      '/pesquisas',
      '/clientes',
      '/minha-conta',
    ]);
  });

  it.each(['analyst', 'client', 'interviewer'] as const)('shows only the basics to %s', (role) => {
    expect(navigationFor(role).map((i) => i.href)).toEqual(['/', '/minha-conta']);
  });

  it('maps a page to the permission it requires', () => {
    expect(requiredPermission('/usuarios')).toBe('users.manage');
    expect(requiredPermission('/usuarios/abc')).toBe('users.manage');
    expect(requiredPermission('/pesquisas/nova')).toBe('surveys.manage');
    expect(requiredPermission('/clientes')).toBe('surveys.manage');
    expect(requiredPermission('/')).toBeUndefined();
    expect(requiredPermission('/minha-conta')).toBeUndefined();
  });
});
