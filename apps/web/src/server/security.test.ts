import { describe, expect, it } from 'vitest';

import { accessTokenCookie, clearedCookie, refreshTokenCookie, SESSION_COOKIES } from './cookies';
import { isProxyablePath } from './api-paths';
import { isSameOrigin } from './origin';
import { contentSecurityPolicy } from './csp';

const NOW = Date.parse('2026-11-04T12:00:00.000Z');

describe('session cookies (rules 1-2)', () => {
  it('access cookie: httpOnly, lax, expires with the token, Secure outside local', () => {
    const local = accessTokenCookie('at', '2026-11-04T12:15:00.000Z', 'local', NOW);
    const prod = accessTokenCookie('at', '2026-11-04T12:15:00.000Z', 'production', NOW);

    expect(local).toEqual({
      name: SESSION_COOKIES.access,
      value: 'at',
      options: { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 900 },
    });
    expect(prod.options.secure).toBe(true);
  });

  it('refresh cookie lasts until the refresh token expires', () => {
    const cookie = refreshTokenCookie('rt', '2026-12-04T12:00:00.000Z', 'staging', NOW);

    expect(cookie.name).toBe(SESSION_COOKIES.refresh);
    expect(cookie.options).toMatchObject({ httpOnly: true, secure: true, maxAge: 30 * 24 * 3600 });
  });

  it('never produces a negative max-age for an already expired token', () => {
    expect(accessTokenCookie('at', '2026-11-04T11:00:00.000Z', 'local', NOW).options.maxAge).toBe(
      0,
    );
  });

  it('clearing a cookie keeps the same attributes with max-age 0', () => {
    expect(clearedCookie(SESSION_COOKIES.refresh, 'production')).toEqual({
      name: 'az_rt',
      value: '',
      options: { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 0 },
    });
  });
});

describe('data proxy allowlist (rule 6)', () => {
  it.each([
    [['users'], 'GET'],
    [['users', '0193a000-0000-7000-8000-000000000001'], 'PATCH'],
    [['auth', 'me'], 'GET'],
    [['auth', 'password'], 'POST'],
  ])('allows /v1/%j via %s', (segments, method) => {
    expect(isProxyablePath(segments, method)).toBe(true);
  });

  it.each([
    [['auth', 'login'], 'POST'],
    [['auth', 'refresh'], 'POST'],
    [['auth', 'logout'], 'POST'],
    [['auth', 'me'], 'POST'],
    [['users', '..', 'auth', 'refresh'], 'GET'],
    [['users', ''], 'GET'],
    [['users%2F..'], 'GET'],
    [[], 'GET'],
  ])('refuses /v1/%j via %s (tokens only move through /api/auth)', (segments, method) => {
    expect(isProxyablePath(segments, method)).toBe(false);
  });
});

describe('same-origin check for state-changing requests (rule 6)', () => {
  const headers = (h: Record<string, string>) => new Headers(h);

  it('lets safe methods through', () => {
    expect(isSameOrigin('GET', headers({ host: 'painel.az' }))).toBe(true);
  });

  it('accepts a POST from the panel itself, also behind a reverse proxy', () => {
    expect(isSameOrigin('POST', headers({ host: 'painel.az', origin: 'https://painel.az' }))).toBe(
      true,
    );
    expect(
      isSameOrigin(
        'POST',
        headers({
          host: 'web:3001',
          'x-forwarded-host': 'pesquisas.azworkcenter.com.br',
          origin: 'https://pesquisas.azworkcenter.com.br',
        }),
      ),
    ).toBe(true);
  });

  it.each([
    ['another site', { host: 'painel.az', origin: 'https://evil.example' }],
    ['no Origin header', { host: 'painel.az' }],
    ['a malformed Origin', { host: 'painel.az', origin: 'null' }],
  ])('refuses a POST from %s', (_case, h) => {
    expect(isSameOrigin('POST', headers(h))).toBe(false);
  });
});

describe('content security policy (rule 14)', () => {
  it('allows only scripts carrying the nonce and forbids framing', () => {
    const csp = contentSecurityPolicy('abc123', { dev: false });

    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-eval');
  });

  it('allows eval only in development (React dev tools need it)', () => {
    expect(contentSecurityPolicy('n', { dev: true })).toContain("'unsafe-eval'");
  });
});
