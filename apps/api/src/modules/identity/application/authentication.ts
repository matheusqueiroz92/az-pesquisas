import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { runWithTenant } from '../../../shared/tenancy/tenant-context.js';
import { REFRESH_TOKEN_TTL_MS, Session } from '../domain/session.js';
import type { User } from '../domain/user.js';
import type { IdentityDeps } from './identity-deps.js';
import type { Actor } from './ports.js';
import { toSummary } from './views.js';
import type { UserSummary } from './views.js';

export interface AuthResult {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: Date;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly user: UserSummary;
}

// A real Argon2 hash of a random value, computed once. Verifying against it when
// the e-mail does not exist makes "unknown e-mail" cost the same as "wrong password".
const dummyHashes = new WeakMap<IdentityDeps['hasher'], Promise<string>>();
const dummyHash = (deps: IdentityDeps): Promise<string> => {
  let hash = dummyHashes.get(deps.hasher);
  if (!hash) {
    hash = deps.hasher.hash(deps.tokens.generate());
    dummyHashes.set(deps.hasher, hash);
  }
  return hash;
};

const issueTokens = async (
  deps: IdentityDeps,
  user: User,
  session: Session,
  refreshToken: string,
  now: Date,
): Promise<AuthResult> => {
  const access = await deps.accessTokens.issue(
    {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      sessionId: session.id,
    },
    now,
  );
  return {
    accessToken: access.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshToken,
    refreshTokenExpiresAt: session.toSnapshot().expiresAt,
    user: toSummary(user),
  };
};

/** Spec 005 rules 7-10: same failure for everything, lockout after 5 wrong passwords. */
export const login = async (
  deps: IdentityDeps,
  input: { email: string; password: string },
): Promise<Result<AuthResult, 'INVALID_CREDENTIALS'>> => {
  const email = input.email.trim().toLowerCase();
  const found = await deps.lookup.findUserByEmail(email);
  if (!found) {
    await deps.hasher.verify(await dummyHash(deps), input.password);
    return err('INVALID_CREDENTIALS');
  }

  return runWithTenant(found.organizationId, () =>
    deps.tx.run(async () => {
      const now = deps.clock.now();
      const user = await deps.users.findById(found.userId, { forUpdate: true });
      if (!user) {
        return err('INVALID_CREDENTIALS');
      }

      // Always verify, even when the account cannot log in: equal timing for every outcome.
      const passwordOk = await deps.hasher.verify(user.passwordHash, input.password);

      if (!user.canAttemptLogin(now)) {
        await deps.audit.record({
          action: 'login.failed',
          actorUserId: user.id,
          entity: 'user',
          entityId: user.id,
          metadata: { reason: user.status === 'active' ? 'locked' : 'disabled' },
        });
        return err('INVALID_CREDENTIALS');
      }

      if (!passwordOk) {
        const { locked } = user.recordFailedLogin(now);
        await deps.users.save(user);
        await deps.audit.record({
          action: 'login.failed',
          actorUserId: user.id,
          entity: 'user',
          entityId: user.id,
          metadata: { reason: 'wrong_password' },
        });
        if (locked) {
          await deps.audit.record({
            action: 'account.locked',
            actorUserId: user.id,
            entity: 'user',
            entityId: user.id,
          });
        }
        return err('INVALID_CREDENTIALS');
      }

      user.recordSuccessfulLogin(now);
      await deps.users.save(user);
      const refreshToken = deps.tokens.generate();
      const session = Session.start({
        id: deps.ids.next(),
        organizationId: user.organizationId,
        userId: user.id,
        tokenHash: deps.tokens.hash(refreshToken),
        now,
        ttlMs: REFRESH_TOKEN_TTL_MS,
      });
      await deps.sessions.add(session);
      await deps.audit.record({
        action: 'login.succeeded',
        actorUserId: user.id,
        entity: 'session',
        entityId: session.id,
      });
      return ok(await issueTokens(deps, user, session, refreshToken, now));
    }),
  );
};

/** Rotation with reuse detection (spec 005 rule 11). */
export const refreshSession = async (
  deps: IdentityDeps,
  input: { refreshToken: string },
): Promise<Result<AuthResult, 'INVALID_REFRESH_TOKEN'>> => {
  const found = await deps.lookup.findSessionByTokenHash(deps.tokens.hash(input.refreshToken));
  if (!found) {
    return err('INVALID_REFRESH_TOKEN');
  }

  return runWithTenant(found.organizationId, () =>
    deps.tx.run(async () => {
      const now = deps.clock.now();
      // Row lock: two concurrent refreshes with the same token cannot both rotate it.
      const session = await deps.sessions.findById(found.sessionId, { forUpdate: true });
      if (!session) {
        return err('INVALID_REFRESH_TOKEN');
      }

      const refreshToken = deps.tokens.generate();
      const rotated = session.rotate({
        nextId: deps.ids.next(),
        nextTokenHash: deps.tokens.hash(refreshToken),
        now,
        ttlMs: REFRESH_TOKEN_TTL_MS,
      });

      if (!rotated.ok) {
        if (rotated.error === 'REFRESH_TOKEN_REUSED') {
          await deps.sessions.revokeFamily(session.familyId, now);
          await deps.audit.record({
            action: 'session.reuse_detected',
            actorUserId: session.userId,
            entity: 'session',
            entityId: session.familyId,
          });
        }
        return err('INVALID_REFRESH_TOKEN');
      }

      const user = await deps.users.findById(session.userId);
      if (user?.status !== 'active') {
        await deps.sessions.revokeFamily(session.familyId, now);
        return err('INVALID_REFRESH_TOKEN');
      }

      await deps.sessions.save(session);
      await deps.sessions.add(rotated.value);
      return ok(await issueTokens(deps, user, rotated.value, refreshToken, now));
    }),
  );
};

/** Always succeeds from the caller's point of view: logging out twice is not an error. */
export const logout = async (
  deps: IdentityDeps,
  input: { refreshToken: string },
): Promise<void> => {
  const found = await deps.lookup.findSessionByTokenHash(deps.tokens.hash(input.refreshToken));
  if (!found) {
    return;
  }
  await runWithTenant(found.organizationId, () =>
    deps.tx.run(async () => {
      const session = await deps.sessions.findById(found.sessionId);
      if (session) {
        await deps.sessions.revokeFamily(session.familyId, deps.clock.now());
      }
    }),
  );
};

export const getMe = (
  deps: IdentityDeps,
  actor: Actor,
): Promise<Result<UserSummary, 'USER_NOT_FOUND'>> =>
  runWithTenant(actor.organizationId, () =>
    deps.tx.run(async () => {
      const user = await deps.users.findById(actor.userId);
      return user ? ok(toSummary(user)) : err('USER_NOT_FOUND');
    }),
  );
