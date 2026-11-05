import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { SignInError } from '../application/session-service';
import type { Session } from '../domain/session';
import { openAppDatabase, sessionService } from './services';

export type AppState =
  | { readonly status: 'loading' }
  | { readonly status: 'database-error'; readonly detail: string }
  | { readonly status: 'signed-out'; readonly cipherVersion: string }
  | { readonly status: 'signed-in'; readonly cipherVersion: string; readonly session: Session };

interface SessionContextValue {
  readonly state: AppState;
  readonly signIn: (email: string, password: string) => Promise<SignInError | null>;
  readonly signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Startup order (spec 008): open the encrypted database first (rule 2: fail
 * closed), then restore the session from the SecureStore without the network (rule 6).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({ status: 'loading' });
  const [cipherVersion, setCipherVersion] = useState('');

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        const opened = await openAppDatabase();
        const session = await sessionService.restore();
        if (cancelled) {
          return;
        }
        setCipherVersion(opened.cipherVersion);
        setState(
          session
            ? { status: 'signed-in', cipherVersion: opened.cipherVersion, session }
            : { status: 'signed-out', cipherVersion: opened.cipherVersion },
        );
      } catch (error: unknown) {
        // The message never carries the key (encrypted-database.ts); it helps support.
        const detail = error instanceof Error ? `${error.name}: ${error.message}` : 'Unknown error';
        if (__DEV__) {
          // eslint-disable-next-line no-console -- dev only: shows in the Metro terminal; never the key.
          console.error('[az] local database failed to open', detail);
        }
        if (!cancelled) {
          setState({ status: 'database-error', detail });
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      sessionService.onSignedOut(() => {
        setState((previous) =>
          previous.status === 'signed-in'
            ? { status: 'signed-out', cipherVersion: previous.cipherVersion }
            : previous,
        );
      }),
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await sessionService.signIn(email, password);
      if (!result.ok) {
        return result.error;
      }
      setState({ status: 'signed-in', cipherVersion, session: result.value });
      return null;
    },
    [cipherVersion],
  );

  const signOut = useCallback(() => sessionService.signOut(), []);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionContextValue => {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
};
