import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { PairedDevice, PairError } from '../application/device-service';
import type { SignInError } from '../application/session-service';
import type { Session } from '../domain/session';
import { deviceService, openAppDatabase, sessionService } from './services';

export type AppState =
  | { readonly status: 'loading' }
  | { readonly status: 'database-error'; readonly detail: string }
  | { readonly status: 'unpaired'; readonly cipherVersion: string }
  | { readonly status: 'signed-out'; readonly cipherVersion: string }
  | { readonly status: 'signed-in'; readonly cipherVersion: string; readonly session: Session };

interface SessionContextValue {
  readonly state: AppState;
  /** The organization link of this installation, when paired (spec 016). */
  readonly device: PairedDevice | null;
  readonly pair: (code: string) => Promise<PairError | null>;
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
  const [device, setDevice] = useState<PairedDevice | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Read through a function: TypeScript keeps `cancelled` narrowed across awaits.
    const isCancelled = () => cancelled;
    const start = async () => {
      try {
        const opened = await openAppDatabase();
        // Not paired yet: nothing else until this device belongs to an organization (spec 016).
        const paired = await deviceService.current();
        const session = paired ? await sessionService.restore() : null;
        if (cancelled) {
          return;
        }
        setCipherVersion(opened.cipherVersion);
        setDevice(paired);
        if (!paired) {
          setState({ status: 'unpaired', cipherVersion: opened.cipherVersion });
          return;
        }
        setState(
          session
            ? { status: 'signed-in', cipherVersion: opened.cipherVersion, session }
            : { status: 'signed-out', cipherVersion: opened.cipherVersion },
        );
        // With network, tell the API we are alive; a revoked device goes back to pairing.
        if ((await deviceService.check()) === 'revoked' && !isCancelled()) {
          await sessionService.signOut();
          setDevice(null);
          setState({ status: 'unpaired', cipherVersion: opened.cipherVersion });
        }
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

  const pair = useCallback(
    async (code: string) => {
      const result = await deviceService.pair(code);
      if (!result.ok) {
        return result.error;
      }
      setDevice(result.value);
      setState({ status: 'signed-out', cipherVersion });
      return null;
    },
    [cipherVersion],
  );

  const value = useMemo(
    () => ({ state, device, pair, signIn, signOut }),
    [state, device, pair, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionContextValue => {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return value;
};
