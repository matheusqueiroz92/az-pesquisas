import type { Role } from '@az-pesquisas/contracts';

import { runWithTenant } from '../../../../shared/tenancy/tenant-context.js';
import { login } from '../authentication.js';
import { createOrganizationWithAdmin } from '../organization-setup.js';
import type { Actor } from '../ports.js';
import { createUser } from '../user-management.js';
import type { Fakes } from './fakes.js';

export const ADMIN_PASSWORD = 'senha-do-admin-123';
export const USER_PASSWORD = 'senha-do-usuario-123';

/** Creates an organization with its admin and returns the admin as an Actor. */
export const setupOrganization = async (fakes: Fakes, slug: string): Promise<Actor> => {
  const created = await createOrganizationWithAdmin(fakes.deps, {
    organizationName: `Instituto ${slug}`,
    slug,
    adminName: `Admin ${slug}`,
    adminEmail: `admin@${slug}.com`,
    adminPassword: ADMIN_PASSWORD,
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  return {
    userId: created.value.adminUserId,
    organizationId: created.value.organizationId,
    role: 'admin',
    sessionId: 'no-session',
  };
};

export const addUser = async (
  fakes: Fakes,
  admin: Actor,
  role: Role,
  email: string,
): Promise<string> => {
  const created = await createUser(fakes.deps, admin, {
    name: `Pessoa ${role}`,
    email,
    role,
    password: USER_PASSWORD,
  });
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value.id;
};

export const actorFor = (admin: Actor, userId: string, role: Role): Actor => ({
  userId,
  organizationId: admin.organizationId,
  role,
  sessionId: 'no-session',
});

/** Logs in and returns the actor + tokens, as the guard would build them. */
export const loginAs = async (fakes: Fakes, email: string, password: string) => {
  const result = await login(fakes.deps, { email, password });
  if (!result.ok) {
    throw new Error(result.error);
  }
  const claims = await fakes.deps.accessTokens.verify(result.value.accessToken);
  if (!claims) {
    throw new Error('invalid access token');
  }
  return { tokens: result.value, actor: claims satisfies Actor };
};

export const inTenant = <T>(actor: Actor, fn: () => T): T =>
  runWithTenant(actor.organizationId, fn);
