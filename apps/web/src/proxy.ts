import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { clearedCookie, SESSION_COOKIES } from './server/cookies';
import type { CookieToSet } from './server/cookies';
import { contentSecurityPolicy } from './server/csp';
import { webEnv } from './server/env';
import { accessTokenNeedsRefresh, refreshCoordinator, sessionCookies } from './server/session';

/** Pages reachable without a session. */
const PUBLIC_PAGES = new Set(['/login', '/esqueci-senha', '/redefinir-senha']);

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

const withSecurityHeaders = (response: NextResponse, csp: string): NextResponse => {
  response.headers.set('Content-Security-Policy', csp);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
};

const redirectTo = (
  request: NextRequest,
  pathname: string,
  csp: string,
  cookies: CookieToSet[],
) => {
  const response = NextResponse.redirect(new URL(pathname, request.url));
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return withSecurityHeaders(response, csp);
};

type SessionState =
  | { kind: 'active' }
  | { kind: 'renewed'; cookies: CookieToSet[] }
  | { kind: 'none'; cookies: CookieToSet[] };

/** Spec 007 rules 3-5: renew silently; a refused renewal clears the cookies. */
const resolveSession = async (request: NextRequest): Promise<SessionState> => {
  const { appEnv } = webEnv();
  const accessToken = request.cookies.get(SESSION_COOKIES.access)?.value;
  const refreshToken = request.cookies.get(SESSION_COOKIES.refresh)?.value;

  if (accessToken && !accessTokenNeedsRefresh(accessToken)) {
    return { kind: 'active' };
  }
  const clear = [
    clearedCookie(SESSION_COOKIES.access, appEnv),
    clearedCookie(SESSION_COOKIES.refresh, appEnv),
  ];
  if (!refreshToken) {
    return { kind: 'none', cookies: accessToken ? clear : [] };
  }
  const outcome = await refreshCoordinator().refresh(refreshToken);
  return outcome.ok
    ? { kind: 'renewed', cookies: sessionCookies(outcome.tokens, appEnv) }
    : { kind: 'none', cookies: clear };
};

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, { dev: process.env.NODE_ENV === 'development' });
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PAGES.has(pathname);

  const session = await resolveSession(request);

  if (session.kind === 'none' && !isPublic) {
    return redirectTo(request, '/login', csp, session.cookies);
  }
  if (session.kind !== 'none' && pathname === '/login') {
    return redirectTo(request, '/', csp, session.kind === 'renewed' ? session.cookies : []);
  }

  // Server Components read cookies from the REQUEST: renewed tokens must be
  // written there too, or this render would still see the old (expired) ones.
  const cookies = session.kind === 'active' ? [] : session.cookies;
  for (const cookie of cookies) {
    if (cookie.value) {
      request.cookies.set(cookie.name, cookie.value);
    } else {
      request.cookies.delete(cookie.name);
    }
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return withSecurityHeaders(response, csp);
}

export const config = {
  // Pages only: /api/* routes handle the session themselves, static files need nothing.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico).*)'],
};
