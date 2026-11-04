import { can } from '@az-pesquisas/contracts';
import type { Role, UserStatus } from '@az-pesquisas/contracts';
import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { runWithTenant } from '../../../shared/tenancy/tenant-context.js';
import { User } from '../domain/user.js';
import type { UserUpdateError } from '../domain/user.js';
import type { IdentityDeps } from './identity-deps.js';
import type { Actor } from './ports.js';
import { toDetails } from './views.js';
import type { UserDetails } from './views.js';

// Authorization lives here, in the use case, not only in the HTTP guard: a job
// or another module calling these functions gets the same check (Fundação › Autorização).
const canManageUsers = (actor: Actor): boolean => can(actor.role, 'users.manage');

export const listUsers = (
  deps: IdentityDeps,
  actor: Actor,
): Promise<Result<UserDetails[], 'FORBIDDEN'>> => {
  if (!canManageUsers(actor)) {
    return Promise.resolve(err('FORBIDDEN'));
  }
  return runWithTenant(actor.organizationId, () =>
    deps.tx.run(async () => ok((await deps.users.list()).map(toDetails))),
  );
};

export const getUser = (
  deps: IdentityDeps,
  actor: Actor,
  userId: string,
): Promise<Result<UserDetails, 'FORBIDDEN' | 'USER_NOT_FOUND'>> => {
  if (!canManageUsers(actor)) {
    return Promise.resolve(err('FORBIDDEN'));
  }
  return runWithTenant(actor.organizationId, () =>
    deps.tx.run(async () => {
      const user = await deps.users.findById(userId);
      return user ? ok(toDetails(user)) : err('USER_NOT_FOUND');
    }),
  );
};

export const createUser = async (
  deps: IdentityDeps,
  actor: Actor,
  input: { name: string; email: string; role: Role; password: string },
): Promise<Result<UserDetails, 'FORBIDDEN' | 'EMAIL_ALREADY_IN_USE'>> => {
  if (!canManageUsers(actor)) {
    return err('FORBIDDEN');
  }
  const email = input.email.trim().toLowerCase();
  // E-mail is the login key across all organizations (spec 005 rule 2).
  if (await deps.lookup.findUserByEmail(email)) {
    return err('EMAIL_ALREADY_IN_USE');
  }
  const passwordHash = await deps.hasher.hash(input.password);

  return runWithTenant(actor.organizationId, () =>
    deps.tx.run(async () => {
      const user = User.register({
        id: deps.ids.next(),
        organizationId: actor.organizationId,
        name: input.name,
        email,
        role: input.role,
        passwordHash,
        now: deps.clock.now(),
      });
      await deps.users.add(user);
      await deps.audit.record({
        action: 'user.created',
        actorUserId: actor.userId,
        entity: 'user',
        entityId: user.id,
        metadata: { role: user.role },
      });
      return ok(toDetails(user));
    }),
  );
};

export const updateUser = (
  deps: IdentityDeps,
  actor: Actor,
  userId: string,
  changes: { name?: string; role?: Role; status?: UserStatus },
): Promise<Result<UserDetails, 'FORBIDDEN' | 'USER_NOT_FOUND' | UserUpdateError>> => {
  if (!canManageUsers(actor)) {
    return Promise.resolve(err('FORBIDDEN'));
  }
  return runWithTenant(actor.organizationId, () =>
    deps.tx.run(async () => {
      const now = deps.clock.now();
      const user = await deps.users.findById(userId, { forUpdate: true });
      if (!user) {
        return err('USER_NOT_FOUND');
      }
      const result = user.update(changes, { userId: actor.userId }, now);
      if (!result.ok) {
        return result;
      }
      if (result.value.changed.length > 0) {
        await deps.users.save(user);
        if (user.status === 'disabled') {
          await deps.sessions.revokeAllForUser(user.id, now);
        }
        await deps.audit.record({
          action: 'user.updated',
          actorUserId: actor.userId,
          entity: 'user',
          entityId: user.id,
          metadata: { changed: result.value.changed },
        });
      }
      return ok(toDetails(user));
    }),
  );
};
