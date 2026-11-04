import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { runWithTenant } from '../../../shared/tenancy/tenant-context.js';
import { PasswordReset } from '../domain/password-reset.js';
import type { IdentityDeps } from './identity-deps.js';
import type { Actor } from './ports.js';

/** Spec 005 rule 14: the caller never learns whether the e-mail exists. */
export const requestPasswordReset = async (
  deps: IdentityDeps,
  input: { email: string },
): Promise<void> => {
  const email = input.email.trim().toLowerCase();
  const found = await deps.lookup.findUserByEmail(email);
  if (!found) {
    return;
  }

  await runWithTenant(found.organizationId, () =>
    deps.tx.run(async () => {
      const user = await deps.users.findById(found.userId);
      if (user?.status !== 'active') {
        return;
      }
      const now = deps.clock.now();
      const token = deps.tokens.generate();
      const reset = PasswordReset.issue({
        id: deps.ids.next(),
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash: deps.tokens.hash(token),
        now,
      });
      await deps.passwordResets.add(reset);
      await deps.audit.record({
        action: 'password.reset_requested',
        actorUserId: null,
        entity: 'user',
        entityId: user.id,
      });
      // Sent inside the transaction: if the e-mail fails, no orphan link is left behind.
      await deps.mailer.send({
        to: user.toSnapshot().email,
        subject: 'Redefinição de senha — AZ Pesquisas',
        text: [
          'Recebemos um pedido para redefinir a sua senha.',
          '',
          `Use este link em até 30 minutos: ${deps.settings.panelUrl}/redefinir-senha?token=${token}`,
          '',
          'Se não foi você, ignore este e-mail: a sua senha continua a mesma.',
        ].join('\n'),
      });
    }),
  );
};

/** Spec 005 rule 15: single use, then every session of the user is revoked. */
export const confirmPasswordReset = async (
  deps: IdentityDeps,
  input: { token: string; newPassword: string },
): Promise<Result<undefined, 'INVALID_RESET_TOKEN'>> => {
  const found = await deps.lookup.findPasswordResetByTokenHash(deps.tokens.hash(input.token));
  if (!found) {
    return err('INVALID_RESET_TOKEN');
  }

  return runWithTenant(found.organizationId, () =>
    deps.tx.run(async () => {
      const now = deps.clock.now();
      const reset = await deps.passwordResets.findById(found.resetId, { forUpdate: true });
      const consumed = reset?.consume(now);
      if (!reset || !consumed?.ok) {
        return err('INVALID_RESET_TOKEN');
      }

      const user = await deps.users.findById(consumed.value.userId, { forUpdate: true });
      if (user?.status !== 'active') {
        return err('INVALID_RESET_TOKEN');
      }

      user.changePassword(await deps.hasher.hash(input.newPassword), now);
      await deps.users.save(user);
      await deps.passwordResets.save(reset);
      await deps.sessions.revokeAllForUser(user.id, now);
      await deps.audit.record({
        action: 'password.reset_completed',
        actorUserId: user.id,
        entity: 'user',
        entityId: user.id,
      });
      return ok(undefined);
    }),
  );
};

/** Spec 005 rule 16: keeps the current login, revokes the others. */
export const changePassword = (
  deps: IdentityDeps,
  actor: Actor,
  input: { currentPassword: string; newPassword: string },
): Promise<Result<undefined, 'INVALID_CURRENT_PASSWORD' | 'USER_NOT_FOUND'>> =>
  runWithTenant(actor.organizationId, () =>
    deps.tx.run(async () => {
      const now = deps.clock.now();
      const user = await deps.users.findById(actor.userId, { forUpdate: true });
      if (!user) {
        return err('USER_NOT_FOUND');
      }
      if (!(await deps.hasher.verify(user.passwordHash, input.currentPassword))) {
        return err('INVALID_CURRENT_PASSWORD');
      }

      user.changePassword(await deps.hasher.hash(input.newPassword), now);
      await deps.users.save(user);
      const current = await deps.sessions.findById(actor.sessionId);
      await deps.sessions.revokeAllForUser(user.id, now, { exceptFamilyId: current?.familyId });
      await deps.audit.record({
        action: 'password.changed',
        actorUserId: user.id,
        entity: 'user',
        entityId: user.id,
      });
      return ok(undefined);
    }),
  );
