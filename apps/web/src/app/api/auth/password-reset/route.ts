import type { NextRequest, NextResponse } from 'next/server';

import { problem, readBody, rejectCrossOrigin, relay, TOO_LARGE } from '@/server/route-helpers';
import { callApi } from '@/server/upstream';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rejected = rejectCrossOrigin(request);
  if (rejected) {
    return rejected;
  }
  const body = await readBody(request);
  if (body === TOO_LARGE) {
    return problem(413, 'PAYLOAD_TOO_LARGE');
  }
  return relay(
    await callApi('/v1/auth/password-reset', { method: 'POST', incoming: request.headers, body }),
  );
}
