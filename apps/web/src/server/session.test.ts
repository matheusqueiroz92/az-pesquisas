import { describe, expect, it, vi } from 'vitest';

import {
  accessTokenNeedsRefresh,
  createApiRefresh,
  refreshCoordinator,
  sessionCookies,
} from './session';

const jwtWithExp = (exp: unknown): string => {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'u', exp })}.signature`;
};

const NOW = Date.parse('2026-11-04T12:00:00Z');

describe('accessTokenNeedsRefresh', () => {
  it('is false while the token has more than 30 s left', () => {
    expect(accessTokenNeedsRefresh(jwtWithExp(NOW / 1000 + 60), NOW)).toBe(false);
  });

  it('is true in the last 30 s, so a page never renders with a token about to die', () => {
    expect(accessTokenNeedsRefresh(jwtWithExp(NOW / 1000 + 29), NOW)).toBe(true);
  });

  it('is true for a missing, malformed or exp-less token', () => {
    expect(accessTokenNeedsRefresh(undefined, NOW)).toBe(true);
    expect(accessTokenNeedsRefresh('not-a-jwt', NOW)).toBe(true);
    expect(accessTokenNeedsRefresh('a.!!!.c', NOW)).toBe(true);
    expect(accessTokenNeedsRefresh(jwtWithExp('soon'), NOW)).toBe(true);
  });
});

const TOKENS = {
  accessToken: 'at-2',
  accessTokenExpiresAt: '2026-11-04T12:15:00.000Z',
  refreshToken: 'rt-2',
  refreshTokenExpiresAt: '2026-12-04T12:00:00.000Z',
  user: {
    id: '0190a5c4-0000-7000-8000-000000000001',
    organizationId: '0190a5c4-0000-7000-8000-000000000002',
    name: 'Ana',
    email: 'ana@az.com.br',
    role: 'admin',
  },
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('createApiRefresh', () => {
  it('posts the refresh token to the API and returns the new pair', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(json(200, TOKENS));
    const refresh = createApiRefresh({ apiUrl: 'http://api:3000', fetch: fetchFn });

    await expect(refresh('rt-1')).resolves.toEqual({
      ok: true,
      tokens: {
        accessToken: 'at-2',
        accessTokenExpiresAt: TOKENS.accessTokenExpiresAt,
        refreshToken: 'rt-2',
        refreshTokenExpiresAt: TOKENS.refreshTokenExpiresAt,
      },
    });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toEqual(new URL('http://api:3000/v1/auth/refresh'));
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"refreshToken":"rt-1"}');
  });

  it.each([400, 401])('treats %i as a refused session (cookies get cleared)', async (status) => {
    const refresh = createApiRefresh({
      apiUrl: 'http://api:3000',
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(json(status, { code: 'INVALID_REFRESH_TOKEN' })),
    });
    await expect(refresh('rt-1')).resolves.toEqual({ ok: false });
  });

  it('throws on server errors so the coordinator does not cache them', async () => {
    const refresh = createApiRefresh({
      apiUrl: 'http://api:3000',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(json(503, { code: 'SERVICE_UNAVAILABLE' })),
    });
    await expect(refresh('rt-1')).rejects.toThrow('503');
  });

  it('throws when the API answers 200 with an unexpected body', async () => {
    const refresh = createApiRefresh({
      apiUrl: 'http://api:3000',
      fetch: vi.fn<typeof fetch>().mockResolvedValue(json(200, { accessToken: 1 })),
    });
    await expect(refresh('rt-1')).rejects.toThrow();
  });
});

describe('sessionCookies', () => {
  it('builds both httpOnly cookies from a token pair', () => {
    const cookies = sessionCookies(TOKENS, 'production', NOW);
    expect(cookies.map((c) => [c.name, c.value, c.options.maxAge, c.options.secure])).toEqual([
      ['az_at', 'at-2', 900, true],
      ['az_rt', 'rt-2', 30 * 24 * 3600, true],
    ]);
  });
});

describe('refreshCoordinator', () => {
  it('is one instance per process, shared by proxy.ts and the route handlers', () => {
    expect(refreshCoordinator()).toBe(refreshCoordinator());
  });
});
