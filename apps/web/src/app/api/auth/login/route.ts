import { TokenResponse } from '@az-pesquisas/contracts';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { webEnv } from '@/server/env';
import {
  problem,
  readBody,
  rejectCrossOrigin,
  relay,
  TOO_LARGE,
  withCookies,
} from '@/server/route-helpers';
import { sessionCookies } from '@/server/session';
import { callApi } from '@/server/upstream';

/** The browser sends e-mail and password; the tokens never come back to it (rule 1). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rejected = rejectCrossOrigin(request);
  if (rejected) {
    return rejected;
  }
  const body = await readBody(request);
  if (body === TOO_LARGE) {
    return problem(413, 'PAYLOAD_TOO_LARGE');
  }
  const upstream = await callApi('/v1/auth/login', {
    method: 'POST',
    incoming: request.headers,
    body,
  });
  if (!upstream.ok) {
    return relay(upstream);
  }
  const tokens = TokenResponse.parse(await upstream.json());
  return withCookies(
    NextResponse.json({ user: tokens.user }),
    sessionCookies(tokens, webEnv().appEnv),
  );
}
