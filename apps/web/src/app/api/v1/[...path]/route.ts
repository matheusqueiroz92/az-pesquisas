import type { NextRequest, NextResponse } from 'next/server';

import { isProxyablePath } from '@/server/api-paths';
import { SESSION_COOKIES } from '@/server/cookies';
import type { CookieToSet } from '@/server/cookies';
import { webEnv } from '@/server/env';
import {
  clearSessionCookies,
  problem,
  readBody,
  rejectCrossOrigin,
  relay,
  TOO_LARGE,
  withCookies,
} from '@/server/route-helpers';
import { accessTokenNeedsRefresh, refreshCoordinator, sessionCookies } from '@/server/session';
import { callApi } from '@/server/upstream';

interface Context {
  readonly params: Promise<{ path: string[] }>;
}

type AccessToken =
  { token: string; cookies: CookieToSet[] } | { token: undefined; cookies: CookieToSet[] };

/** Same renewal as proxy.ts (and the same coordinator), for calls made by the browser. */
const accessToken = async (request: NextRequest): Promise<AccessToken> => {
  const current = request.cookies.get(SESSION_COOKIES.access)?.value;
  if (current && !accessTokenNeedsRefresh(current)) {
    return { token: current, cookies: [] };
  }
  const refreshToken = request.cookies.get(SESSION_COOKIES.refresh)?.value;
  if (!refreshToken) {
    return { token: undefined, cookies: [] };
  }
  const outcome = await refreshCoordinator().refresh(refreshToken);
  return outcome.ok
    ? {
        token: outcome.tokens.accessToken,
        cookies: sessionCookies(outcome.tokens, webEnv().appEnv),
      }
    : { token: undefined, cookies: clearSessionCookies() };
};

/** Data proxy: the browser reaches /v1/* only through here, with the token from the cookie. */
const handle = async (request: NextRequest, context: Context): Promise<NextResponse> => {
  const { path } = await context.params;
  if (!isProxyablePath(path, request.method)) {
    return problem(404, 'NOT_FOUND');
  }
  const rejected = rejectCrossOrigin(request);
  if (rejected) {
    return rejected;
  }
  const body = request.method === 'GET' ? undefined : await readBody(request);
  if (body === TOO_LARGE) {
    return problem(413, 'PAYLOAD_TOO_LARGE');
  }
  const session = await accessToken(request);
  if (!session.token) {
    return withCookies(problem(401, 'UNAUTHENTICATED'), session.cookies);
  }
  const upstream = await callApi(`/v1/${path.join('/')}`, {
    method: request.method,
    incoming: request.headers,
    accessToken: session.token,
    body,
    search: request.nextUrl.search,
  });
  return withCookies(await relay(upstream), session.cookies);
};

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
