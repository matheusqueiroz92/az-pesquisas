import { TokenResponse } from '@az-pesquisas/contracts';

import { accessTokenCookie, refreshTokenCookie } from './cookies';
import type { AppEnv, CookieToSet } from './cookies';
import { createRefreshCoordinator } from './refresh-coordinator';
import type { RefreshOutcome, SessionTokens } from './refresh-coordinator';
import { webEnv } from './env';

/** Renew when less than this is left, so a page never renders with a dying token. */
const REFRESH_MARGIN_SECONDS = 30;

/**
 * Reads `exp` from the JWT payload WITHOUT verifying the signature: it only
 * decides when to renew. The API verifies every token it receives.
 */
export const accessTokenNeedsRefresh = (token: string | undefined, now = Date.now()): boolean => {
  const payload = token?.split('.')[1];
  if (!payload) {
    return true;
  }
  try {
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const exp =
      typeof claims === 'object' && claims !== null && 'exp' in claims ? claims.exp : undefined;
    return typeof exp !== 'number' || exp - now / 1000 < REFRESH_MARGIN_SECONDS;
  } catch {
    return true;
  }
};

/** Calls POST /v1/auth/refresh. 400/401 = session refused; anything else unexpected throws. */
export const createApiRefresh =
  (deps: { apiUrl: string; fetch: typeof fetch }) =>
  async (refreshToken: string): Promise<RefreshOutcome> => {
    const response = await deps.fetch(new URL('/v1/auth/refresh', deps.apiUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (response.status === 400 || response.status === 401) {
      return { ok: false };
    }
    if (!response.ok) {
      throw new Error(`Refresh failed with status ${response.status}`);
    }
    const body = TokenResponse.parse(await response.json());
    return {
      ok: true,
      tokens: {
        accessToken: body.accessToken,
        accessTokenExpiresAt: body.accessTokenExpiresAt,
        refreshToken: body.refreshToken,
        refreshTokenExpiresAt: body.refreshTokenExpiresAt,
      },
    };
  };

export const sessionCookies = (
  tokens: SessionTokens,
  appEnv: AppEnv,
  now = Date.now(),
): CookieToSet[] => [
  accessTokenCookie(tokens.accessToken, tokens.accessTokenExpiresAt, appEnv, now),
  refreshTokenCookie(tokens.refreshToken, tokens.refreshTokenExpiresAt, appEnv, now),
];

type Coordinator = ReturnType<typeof createRefreshCoordinator>;
const GLOBAL_KEY = Symbol.for('az-pesquisas.refresh-coordinator');

/**
 * One coordinator per process. `proxy.ts` and the route handlers are bundled
 * separately by Next.js, so a module-level variable would give each bundle
 * its own map and two refreshes could race; globalThis is shared.
 */
export const refreshCoordinator = (): Coordinator => {
  const holder = globalThis as typeof globalThis & { [GLOBAL_KEY]?: Coordinator };
  holder[GLOBAL_KEY] ??= createRefreshCoordinator({
    refresh: createApiRefresh({ apiUrl: webEnv().apiUrl, fetch }),
  });
  return holder[GLOBAL_KEY];
};
