import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { accessTokenIsFresh, canUseFieldApp } from '../domain/session';
import type { Session } from '../domain/session';
import type { AuthGateway, Clock, GatewayError, SessionStore } from './ports';

export type SignInError = GatewayError | { readonly kind: 'role-not-allowed' };
export type TokenError =
  | { readonly kind: 'offline' }
  | { readonly kind: 'server'; readonly status: number }
  | { readonly kind: 'signed-out' };

/**
 * The device's session (spec 008, rules 4-10).
 *
 * - Restoring never touches the network: field work goes on offline (rule 6).
 * - Renewal happens only when a call to the API needs it, one at a time (rule 7).
 * - Only an explicit refusal from the API ends the session (rule 8); no network
 *   or a server error keep it.
 */
export const createSessionService = (deps: {
  gateway: AuthGateway;
  store: SessionStore;
  clock: Clock;
}) => {
  let session: Session | null = null;
  let renewal: Promise<Result<string, TokenError>> | null = null;
  const listeners = new Set<() => void>();

  const end = async (): Promise<void> => {
    session = null;
    await deps.store.clear();
    for (const listener of listeners) {
      listener();
    }
  };

  const renew = async (current: Session): Promise<Result<string, TokenError>> => {
    const result = await deps.gateway.refresh(current.refreshToken);
    if (result.ok) {
      if (!canUseFieldApp(result.value.user.role)) {
        await deps.gateway.logout(result.value.refreshToken);
        await end();
        return err({ kind: 'signed-out' });
      }
      session = result.value;
      await deps.store.save(result.value);
      return ok(result.value.accessToken);
    }
    if (result.error.kind === 'rejected') {
      await end();
      return err({ kind: 'signed-out' });
    }
    return err(result.error);
  };

  return {
    current: (): Session | null => session,

    restore: async (): Promise<Session | null> => {
      session = await deps.store.load();
      return session;
    },

    signIn: async (email: string, password: string): Promise<Result<Session, SignInError>> => {
      const result = await deps.gateway.login(email, password);
      if (!result.ok) {
        return result;
      }
      if (!canUseFieldApp(result.value.user.role)) {
        await deps.gateway.logout(result.value.refreshToken);
        return err({ kind: 'role-not-allowed' });
      }
      session = result.value;
      await deps.store.save(result.value);
      return ok(result.value);
    },

    getAccessToken: (): Promise<Result<string, TokenError>> => {
      if (!session) {
        return Promise.resolve(err({ kind: 'signed-out' }));
      }
      if (accessTokenIsFresh(session, deps.clock.now())) {
        return Promise.resolve(ok(session.accessToken));
      }
      renewal ??= renew(session).finally(() => {
        renewal = null;
      });
      return renewal;
    },

    signOut: async (): Promise<void> => {
      if (!session) {
        return;
      }
      // Rule 10: revoke if the network allows, but never make the person wait.
      void deps.gateway.logout(session.refreshToken);
      await end();
    },

    onSignedOut: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

export type SessionService = ReturnType<typeof createSessionService>;
