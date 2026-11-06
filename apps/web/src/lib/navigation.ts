import { can } from '@az-pesquisas/contracts';
import type { Permission, Role } from '@az-pesquisas/contracts';

import { t } from '@/i18n/pt-BR';

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly permission?: Permission;
}

/** The sidebar. Same permission matrix as the API (packages/contracts). */
const ITEMS: readonly NavItem[] = [
  { href: '/', label: t.nav.home },
  { href: '/pesquisas', label: t.nav.surveys, permission: 'surveys.manage' },
  { href: '/clientes', label: t.nav.clients, permission: 'surveys.manage' },
  { href: '/dispositivos', label: t.nav.devices, permission: 'devices.manage' },
  { href: '/usuarios', label: t.nav.users, permission: 'users.manage' },
  { href: '/minha-conta', label: t.nav.account },
];

export const navigationFor = (role: Role): NavItem[] =>
  ITEMS.filter((item) => item.permission === undefined || can(role, item.permission));

/** Permission a page needs, by its path prefix (pages call this to show "Sem permissão"). */
export const requiredPermission = (pathname: string): Permission | undefined =>
  ITEMS.find(
    (item) => item.href !== '/' && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )?.permission;
