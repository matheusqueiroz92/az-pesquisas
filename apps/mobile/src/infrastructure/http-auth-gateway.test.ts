import { err, ok } from '@az-pesquisas/core';
import { describe, expect, it, vi } from 'vitest';

import { createHttpAuthGateway } from './http-auth-gateway';

const TOKENS = {
  accessToken: 'at',
  accessTokenExpiresAt: '2026-11-05T12:15:00.000Z',
  refreshToken: 'rt',
  refreshTokenExpiresAt: '2026-12-05T12:00:00.000Z',
  user: {
    id: '0190a5c4-0000-7000-8000-000000000001',
    organizationId: '0190a5c4-0000-7000-8000-000000000002',
    name: 'Paula',
    email: 'paula@az.test',
    role: 'interviewer',
  },
};

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const gatewayWith = (response: Response | Error) => {
  const fetchFn = vi.fn<typeof fetch>();
  if (response instanceof Error) {
    fetchFn.mockRejectedValue(response);
  } else {
    fetchFn.mockResolvedValue(response);
  }
  return {
    gateway: createHttpAuthGateway({ apiUrl: 'http://10.0.2.2:3000', fetch: fetchFn }),
    fetchFn,
  };
};

describe('HttpAuthGateway', () => {
  it('logs in with POST /v1/auth/login and returns the session', async () => {
    const { gateway, fetchFn } = gatewayWith(json(200, TOKENS));
    expect(await gateway.login('paula@az.test', 'senha-123456')).toEqual(ok(TOKENS));
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('http://10.0.2.2:3000/v1/auth/login');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"email":"paula@az.test","password":"senha-123456"}');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });

  it('refreshes with POST /v1/auth/refresh', async () => {
    const { gateway, fetchFn } = gatewayWith(json(200, TOKENS));
    expect(await gateway.refresh('rt-old')).toEqual(ok(TOKENS));
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://10.0.2.2:3000/v1/auth/refresh');
    expect(fetchFn.mock.calls[0]?.[1]?.body).toBe('{"refreshToken":"rt-old"}');
  });

  it('maps 4xx to rejected with the Problem Details code', async () => {
    const { gateway } = gatewayWith(json(401, { code: 'INVALID_CREDENTIALS' }));
    expect(await gateway.login('a@b.co', 'x')).toEqual(
      err({ kind: 'rejected', status: 401, code: 'INVALID_CREDENTIALS' }),
    );
  });

  it('copes with a 4xx without a JSON body', async () => {
    const { gateway } = gatewayWith(new Response('nope', { status: 429 }));
    expect(await gateway.login('a@b.co', 'x')).toEqual(
      err({ kind: 'rejected', status: 429, code: undefined }),
    );
  });

  it('maps 5xx to server', async () => {
    const { gateway } = gatewayWith(json(503, { code: 'SERVICE_UNAVAILABLE' }));
    expect(await gateway.refresh('rt')).toEqual(err({ kind: 'server', status: 503 }));
  });

  it('maps a network failure or timeout to offline', async () => {
    expect(
      await gatewayWith(new TypeError('Network request failed')).gateway.login('a@b.co', 'x'),
    ).toEqual(err({ kind: 'offline' }));
    expect(
      await gatewayWith(new DOMException('timeout', 'TimeoutError')).gateway.refresh('rt'),
    ).toEqual(err({ kind: 'offline' }));
  });

  it('treats an unexpected 200 body as a server error, never as a session', async () => {
    const { gateway } = gatewayWith(json(200, { accessToken: 1 }));
    expect(await gateway.login('a@b.co', 'x')).toEqual(err({ kind: 'server', status: 200 }));
  });

  it('logout posts the refresh token and swallows every failure', async () => {
    const { gateway, fetchFn } = gatewayWith(json(204));
    await gateway.logout('rt');
    expect(fetchFn.mock.calls[0]?.[0]).toBe('http://10.0.2.2:3000/v1/auth/logout');
    await expect(
      gatewayWith(new TypeError('offline')).gateway.logout('rt'),
    ).resolves.toBeUndefined();
  });

  it('accepts an API URL with a trailing slash', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(200, TOKENS));
    await createHttpAuthGateway({ apiUrl: 'https://api.az.test/', fetch: fetchFn }).login(
      'a@b.co',
      'x',
    );
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.az.test/v1/auth/login');
  });
});
