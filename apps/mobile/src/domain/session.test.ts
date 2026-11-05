import { describe, expect, it } from 'vitest';

import { accessTokenIsFresh, canUseFieldApp, sessionFromTokens } from './session';

const TOKENS = {
  accessToken: 'at',
  accessTokenExpiresAt: '2026-11-05T12:15:00.000Z',
  refreshToken: 'rt',
  refreshTokenExpiresAt: '2026-12-05T12:00:00.000Z',
  user: {
    id: '0190a5c4-0000-7000-8000-000000000001',
    organizationId: '0190a5c4-0000-7000-8000-000000000002',
    name: 'Paula Pesquisadora',
    email: 'paula@az.test',
    role: 'interviewer' as const,
  },
};

describe('canUseFieldApp (spec 008, decision 2)', () => {
  it.each(['interviewer', 'coordinator'] as const)('lets %s in', (role) => {
    expect(canUseFieldApp(role)).toBe(true);
  });

  it.each(['admin', 'analyst', 'client'] as const)('keeps %s out (panel only)', (role) => {
    expect(canUseFieldApp(role)).toBe(false);
  });
});

describe('session', () => {
  it('is built from the API token response', () => {
    expect(sessionFromTokens(TOKENS)).toEqual(TOKENS);
  });

  it('access token is fresh until 30 s before it expires', () => {
    const session = sessionFromTokens(TOKENS);
    const expiry = Date.parse(TOKENS.accessTokenExpiresAt);
    expect(accessTokenIsFresh(session, expiry - 31_000)).toBe(true);
    expect(accessTokenIsFresh(session, expiry - 29_000)).toBe(false);
    expect(accessTokenIsFresh(session, expiry + 1)).toBe(false);
  });
});
