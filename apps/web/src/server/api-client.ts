import { MeResponse } from '@az-pesquisas/contracts';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';

import { SESSION_COOKIES } from './cookies';
import { callApi } from './upstream';

export type ApiRead<T> = { ok: true; data: T } | { ok: false; status: number };

interface Schema<T> {
  parse: (value: unknown) => T;
}

/**
 * GET from a Server Component with the token from the cookie (already renewed
 * by proxy.ts). A 401 here means the session died mid-way: clear and log in.
 */
export const apiGet = async <T>(path: string, schema: Schema<T>): Promise<ApiRead<T>> => {
  const accessToken = (await cookies()).get(SESSION_COOKIES.access)?.value;
  if (!accessToken) {
    redirect('/api/auth/session-expired');
  }
  const response = await callApi(path, { method: 'GET', incoming: await headers(), accessToken });
  if (response.status === 401) {
    redirect('/api/auth/session-expired');
  }
  if (!response.ok) {
    return { ok: false, status: response.status };
  }
  return { ok: true, data: schema.parse(await response.json()) };
};

/** The logged-in user, fetched once per render. */
export const currentUser = cache(async (): Promise<MeResponse> => {
  const me = await apiGet('/v1/auth/me', MeResponse);
  if (!me.ok) {
    throw new Error(`GET /v1/auth/me failed with status ${me.status}`);
  }
  return me.data;
});
