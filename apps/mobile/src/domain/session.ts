import type { MeResponse, Role } from '@az-pesquisas/contracts';

/** Spec 008, decision 2: who may sign in on the field app. Admin, analyst and client use the panel. */
export const FIELD_APP_ROLES: readonly Role[] = ['interviewer', 'coordinator'];

export const canUseFieldApp = (role: Role): boolean => FIELD_APP_ROLES.includes(role);

/** What the device keeps (in the SecureStore, never in SQLite or logs). */
export interface Session {
  readonly accessToken: string;
  readonly accessTokenExpiresAt: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
  readonly user: MeResponse;
}

export const sessionFromTokens = (tokens: Session): Session => ({
  accessToken: tokens.accessToken,
  accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  refreshToken: tokens.refreshToken,
  refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  user: tokens.user,
});

/** Renew a little early, so a request never leaves with a token about to expire. */
const MARGIN_MS = 30_000;

export const accessTokenIsFresh = (session: Session, now: number): boolean =>
  Date.parse(session.accessTokenExpiresAt) - now > MARGIN_MS;
