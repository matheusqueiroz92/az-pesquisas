import type { Result } from '@az-pesquisas/core';

import type { Session } from '../domain/session';

/** Why the API could not answer as hoped. `rejected` carries the API's stable error code. */
export type GatewayError =
  | { readonly kind: 'offline' }
  | { readonly kind: 'rejected'; readonly status: number; readonly code: string | undefined }
  | { readonly kind: 'server'; readonly status: number };

export interface AuthGateway {
  readonly login: (email: string, password: string) => Promise<Result<Session, GatewayError>>;
  readonly refresh: (refreshToken: string) => Promise<Result<Session, GatewayError>>;
  /** Best effort: never throws. */
  readonly logout: (refreshToken: string) => Promise<void>;
}

/** The device's secure storage for the session (SecureStore). */
export interface SessionStore {
  readonly load: () => Promise<Session | null>;
  readonly save: (session: Session) => Promise<void>;
  readonly clear: () => Promise<void>;
}

export interface Clock {
  readonly now: () => number;
}
