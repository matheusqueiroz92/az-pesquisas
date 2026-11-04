import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { clearedCookie, SESSION_COOKIES } from './cookies';
import type { CookieToSet } from './cookies';
import { webEnv } from './env';
import { isSameOrigin } from './origin';

/** Body in the API's own Problem Details shape, so the browser handles one format. */
export const problem = (status: number, code: string): NextResponse =>
  NextResponse.json(
    { type: 'about:blank', title: code, status, code },
    { status, headers: { 'content-type': 'application/problem+json' } },
  );

export const withCookies = (
  response: NextResponse,
  cookies: readonly CookieToSet[],
): NextResponse => {
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
};

export const clearSessionCookies = (): CookieToSet[] => {
  const { appEnv } = webEnv();
  return [
    clearedCookie(SESSION_COOKIES.access, appEnv),
    clearedCookie(SESSION_COOKIES.refresh, appEnv),
  ];
};

/** Rule 6: state-changing /api routes refuse other origins. */
export const rejectCrossOrigin = (request: NextRequest): NextResponse | undefined =>
  isSameOrigin(request.method, request.headers) ? undefined : problem(403, 'FORBIDDEN');

const MAX_BODY_BYTES = 64 * 1024;

export const TOO_LARGE = Symbol('too-large');

/** Reads the body as text (the API validates it). Undefined when there is none. */
export const readBody = async (
  request: NextRequest,
): Promise<string | undefined | typeof TOO_LARGE> => {
  const text = await request.text();
  if (text.length === 0) {
    return undefined;
  }
  return Buffer.byteLength(text) > MAX_BODY_BYTES ? TOO_LARGE : text;
};

/** Copies an API response (status, JSON body) without its headers. */
export const relay = async (upstream: Response): Promise<NextResponse> => {
  if (upstream.status === 204 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }
  const contentType = upstream.headers.get('content-type') ?? 'application/json';
  return new NextResponse(await upstream.text(), {
    status: upstream.status,
    headers: { 'content-type': contentType },
  });
};
