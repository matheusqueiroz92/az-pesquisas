import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIES } from '@/server/cookies';
import { clearSessionCookies, rejectCrossOrigin, withCookies } from '@/server/route-helpers';
import { callApi } from '@/server/upstream';

/** Revokes the session in the API and clears the cookies, even if the API is unreachable. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rejected = rejectCrossOrigin(request);
  if (rejected) {
    return rejected;
  }
  const refreshToken = request.cookies.get(SESSION_COOKIES.refresh)?.value;
  if (refreshToken) {
    await callApi('/v1/auth/logout', {
      method: 'POST',
      incoming: request.headers,
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  return withCookies(new NextResponse(null, { status: 204 }), clearSessionCookies());
}
