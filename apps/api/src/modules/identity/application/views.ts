import type { Role, UserStatus } from '@az-pesquisas/contracts';

import type { User } from '../domain/user.js';

/** What the logged-in user sees about themself (MeResponse). */
export interface UserSummary {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
}

/** What an admin sees about a user (UserView). Never includes the password hash. */
export interface UserDetails {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
}

export const toSummary = (user: User): UserSummary => {
  const s = user.toSnapshot();
  return { id: s.id, organizationId: s.organizationId, name: s.name, email: s.email, role: s.role };
};

export const toDetails = (user: User): UserDetails => {
  const s = user.toSnapshot();
  return {
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    status: s.status,
    lastLoginAt: s.lastLoginAt,
    createdAt: s.createdAt,
  };
};
