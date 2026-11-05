import { TokenResponse } from '@az-pesquisas/contracts';
import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import type { AuthGateway, GatewayError } from '../application/ports';
import type { Session } from '../domain/session';

/** Field networks are slow: give up after this and treat it as offline. */
const TIMEOUT_MS = 15_000;

const codeOf = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string'
      ? body.code
      : undefined;
  } catch {
    return undefined;
  }
};

/** Talks to the API's /v1/auth routes. Bodies are validated with the shared contracts. */
export const createHttpAuthGateway = (deps: {
  apiUrl: string;
  fetch: typeof fetch;
}): AuthGateway => {
  const base = deps.apiUrl.replace(/\/+$/, '');

  const post = async (path: string, body: unknown): Promise<Result<Response, GatewayError>> => {
    // AbortController + setTimeout: AbortSignal.timeout() is not available on every RN runtime.
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);
    try {
      return ok(
        await deps.fetch(`${base}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
      );
    } catch {
      // No network ("Network request failed") or the timeout above.
      return err({ kind: 'offline' });
    } finally {
      clearTimeout(timer);
    }
  };

  const toSession = async (path: string, body: unknown): Promise<Result<Session, GatewayError>> => {
    const sent = await post(path, body);
    if (!sent.ok) {
      return sent;
    }
    const response = sent.value;
    if (response.status >= 500) {
      return err({ kind: 'server', status: response.status });
    }
    if (!response.ok) {
      return err({ kind: 'rejected', status: response.status, code: await codeOf(response) });
    }
    const parsed = TokenResponse.safeParse(await response.json().catch(() => undefined));
    return parsed.success ? ok(parsed.data) : err({ kind: 'server', status: response.status });
  };

  return {
    login: (email, password) => toSession('/v1/auth/login', { email, password }),
    refresh: (refreshToken) => toSession('/v1/auth/refresh', { refreshToken }),
    logout: async (refreshToken) => {
      await post('/v1/auth/logout', { refreshToken });
    },
  };
};
