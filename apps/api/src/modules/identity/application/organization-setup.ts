import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { runWithTenant } from '../../../shared/tenancy/tenant-context.js';
import { User } from '../domain/user.js';
import type { IdentityDeps } from './identity-deps.js';

/**
 * Creates an organization and its first admin (spec 005 rule 19). There is no
 * public sign-up: this runs from the `seed:admin` command (and, later, from the
 * platform console of the SaaS).
 */
export const createOrganizationWithAdmin = async (
  deps: IdentityDeps,
  input: {
    organizationName: string;
    slug: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  },
): Promise<Result<{ organizationId: string; adminUserId: string }, 'EMAIL_ALREADY_IN_USE'>> => {
  const email = input.adminEmail.trim().toLowerCase();
  if (await deps.lookup.findUserByEmail(email)) {
    return err('EMAIL_ALREADY_IN_USE');
  }
  const organizationId = deps.ids.next();
  const passwordHash = await deps.hasher.hash(input.adminPassword);

  // A brand-new organization is its own tenant: RLS lets it insert its own row.
  return runWithTenant(organizationId, () =>
    deps.tx.run(async () => {
      const now = deps.clock.now();
      await deps.organizations.add({
        id: organizationId,
        name: input.organizationName.trim(),
        slug: input.slug.trim().toLowerCase(),
        now,
      });
      const admin = User.register({
        id: deps.ids.next(),
        organizationId,
        name: input.adminName,
        email,
        role: 'admin',
        passwordHash,
        now,
      });
      await deps.users.add(admin);
      await deps.audit.record({
        action: 'organization.created',
        actorUserId: null,
        entity: 'organization',
        entityId: organizationId,
      });
      await deps.audit.record({
        action: 'user.created',
        actorUserId: null,
        entity: 'user',
        entityId: admin.id,
        metadata: { role: 'admin' },
      });
      return ok({ organizationId, adminUserId: admin.id });
    }),
  );
};
