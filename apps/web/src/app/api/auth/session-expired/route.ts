import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { clearSessionCookies, withCookies } from '@/server/route-helpers';

/**
 * Where a Server Component sends the person when the API refuses the token
 * mid-render (session revoked, user disabled). Only clears cookies, so being a
 * GET is harmless.
 */
export function GET(request: NextRequest): NextResponse {
  return withCookies(NextResponse.redirect(new URL('/login', request.url)), clearSessionCookies());
}
