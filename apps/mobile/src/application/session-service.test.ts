import { err, ok } from '@az-pesquisas/core';
import { describe, expect, it, vi } from 'vitest';

import type { Session } from '../domain/session';
import type { AuthGateway, GatewayError, SessionStore } from './ports';
import { createSessionService } from './session-service';

const T0 = Date.parse('2026-11-05T12:00:00Z');

const session = (
  overrides: Partial<Session> & { role?: Session['user']['role'] } = {},
): Session => ({
  accessToken: 'at-1',
  accessTokenExpiresAt: new Date(T0 + 15 * 60_000).toISOString(),
  refreshToken: 'rt-1',
  refreshTokenExpiresAt: new Date(T0 + 30 * 24 * 3600_000).toISOString(),
  user: {
    id: '0190a5c4-0000-7000-8000-000000000001',
    organizationId: '0190a5c4-0000-7000-8000-000000000002',
    name: 'Paula Pesquisadora',
    email: 'paula@az.test',
    role: overrides.role ?? 'interviewer',
  },
  ...overrides,
});

const memoryStore = (initial: Session | null = null): SessionStore & { value: Session | null } => {
  const store = {
    value: initial,
    load: () => Promise.resolve(store.value),
    save: (s: Session) => {
      store.value = s;
      return Promise.resolve();
    },
    clear: () => {
      store.value = null;
      return Promise.resolve();
    },
  };
  return store;
};

const gateway = (overrides: Partial<AuthGateway> = {}): AuthGateway => ({
  login: vi.fn<AuthGateway['login']>().mockResolvedValue(ok(session())),
  refresh: vi
    .fn<AuthGateway['refresh']>()
    .mockResolvedValue(ok(session({ accessToken: 'at-2', refreshToken: 'rt-2' }))),
  logout: vi.fn<AuthGateway['logout']>().mockResolvedValue(undefined),
  ...overrides,
});

const setup = (options: { stored?: Session | null; gateway?: AuthGateway; now?: number } = {}) => {
  const store = memoryStore(options.stored ?? null);
  const gw = options.gateway ?? gateway();
  let now = options.now ?? T0;
  const service = createSessionService({ gateway: gw, store, clock: { now: () => now } });
  return { service, store, gw, advance: (ms: number) => (now += ms) };
};

describe('signIn (rule 4)', () => {
  it('saves the session of an interviewer', async () => {
    const { service, store } = setup();
    const result = await service.signIn('paula@az.test', 'senha-123456');
    expect(result).toEqual(ok(session()));
    expect(store.value).toEqual(session());
    expect(service.current()).toEqual(session());
  });

  it('passes the API refusal through (generic message comes from the code)', async () => {
    const refusal: GatewayError = { kind: 'rejected', status: 401, code: 'INVALID_CREDENTIALS' };
    const { service, store } = setup({
      gateway: gateway({ login: vi.fn<AuthGateway['login']>().mockResolvedValue(err(refusal)) }),
    });
    expect(await service.signIn('paula@az.test', 'errada')).toEqual(err(refusal));
    expect(store.value).toBeNull();
  });

  it('says offline when there is no network', async () => {
    const { service } = setup({
      gateway: gateway({
        login: vi.fn<AuthGateway['login']>().mockResolvedValue(err({ kind: 'offline' })),
      }),
    });
    expect(await service.signIn('a@b.co', 'x')).toEqual(err({ kind: 'offline' }));
  });

  it('refuses roles outside the field app and revokes that session (rule 9)', async () => {
    const admin = session({ role: 'admin', refreshToken: 'rt-admin' });
    const gw = gateway({ login: vi.fn<AuthGateway['login']>().mockResolvedValue(ok(admin)) });
    const { service, store } = setup({ gateway: gw });
    expect(await service.signIn('admin@az.test', 'senha-123456')).toEqual(
      err({ kind: 'role-not-allowed' }),
    );
    expect(gw.logout).toHaveBeenCalledWith('rt-admin');
    expect(store.value).toBeNull();
    expect(service.current()).toBeNull();
  });
});

describe('restore (rule 6: works offline, even with an expired access token)', () => {
  it('returns the stored session without calling the API', async () => {
    const stored = session();
    const { service, gw, advance } = setup({ stored });
    advance(60 * 60_000);
    expect(await service.restore()).toEqual(stored);
    expect(gw.refresh).not.toHaveBeenCalled();
  });

  it('returns null when nobody signed in', async () => {
    const { service } = setup();
    expect(await service.restore()).toBeNull();
  });
});

describe('getAccessToken (rule 7)', () => {
  it('returns the stored token while it is fresh', async () => {
    const { service, gw } = setup({ stored: session() });
    await service.restore();
    expect(await service.getAccessToken()).toEqual(ok('at-1'));
    expect(gw.refresh).not.toHaveBeenCalled();
  });

  it('renews once for concurrent callers (CA-06) and saves the new pair', async () => {
    let release: () => void = () => undefined;
    const refresh = vi.fn<AuthGateway['refresh']>().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve(ok(session({ accessToken: 'at-2', refreshToken: 'rt-2' })));
          };
        }),
    );
    const { service, store, advance } = setup({ stored: session(), gateway: gateway({ refresh }) });
    await service.restore();
    advance(20 * 60_000);

    const calls = Promise.all([
      service.getAccessToken(),
      service.getAccessToken(),
      service.getAccessToken(),
    ]);
    release();
    expect(await calls).toEqual([ok('at-2'), ok('at-2'), ok('at-2')]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('rt-1');
    expect(store.value?.refreshToken).toBe('rt-2');
  });

  it('renews again later with the rotated token', async () => {
    const refresh = vi
      .fn<AuthGateway['refresh']>()
      .mockResolvedValueOnce(ok(session({ accessToken: 'at-2', refreshToken: 'rt-2' })))
      .mockResolvedValueOnce(ok(session({ accessToken: 'at-3', refreshToken: 'rt-3' })));
    const { service, advance } = setup({ stored: session(), gateway: gateway({ refresh }) });
    await service.restore();
    advance(20 * 60_000);
    await service.getAccessToken();
    advance(20 * 60_000);
    expect(await service.getAccessToken()).toEqual(ok('at-3'));
    expect(refresh).toHaveBeenLastCalledWith('rt-2');
  });

  it('keeps the session when the network is down', async () => {
    const { service, store, advance } = setup({
      stored: session(),
      gateway: gateway({
        refresh: vi.fn<AuthGateway['refresh']>().mockResolvedValue(err({ kind: 'offline' })),
      }),
    });
    await service.restore();
    advance(20 * 60_000);
    expect(await service.getAccessToken()).toEqual(err({ kind: 'offline' }));
    expect(store.value).not.toBeNull();
    expect(service.current()).not.toBeNull();
  });

  it('keeps the session on a server error', async () => {
    const { service, store, advance } = setup({
      stored: session(),
      gateway: gateway({
        refresh: vi
          .fn<AuthGateway['refresh']>()
          .mockResolvedValue(err({ kind: 'server', status: 503 })),
      }),
    });
    await service.restore();
    advance(20 * 60_000);
    expect(await service.getAccessToken()).toEqual(err({ kind: 'server', status: 503 }));
    expect(store.value).not.toBeNull();
  });

  it('signs out when the API refuses the renewal (rule 8, CA-04) and tells the listeners', async () => {
    const { service, store, advance } = setup({
      stored: session(),
      gateway: gateway({
        refresh: vi
          .fn<AuthGateway['refresh']>()
          .mockResolvedValue(err({ kind: 'rejected', status: 401, code: 'INVALID_REFRESH_TOKEN' })),
      }),
    });
    const listener = vi.fn();
    service.onSignedOut(listener);
    await service.restore();
    advance(20 * 60_000);
    expect(await service.getAccessToken()).toEqual(err({ kind: 'signed-out' }));
    expect(store.value).toBeNull();
    expect(service.current()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('says signed-out when there is no session at all', async () => {
    const { service } = setup();
    expect(await service.getAccessToken()).toEqual(err({ kind: 'signed-out' }));
  });

  it('a renewed session with a role that lost access signs out', async () => {
    const { service, store, advance } = setup({
      stored: session(),
      gateway: gateway({
        refresh: vi
          .fn<AuthGateway['refresh']>()
          .mockResolvedValue(ok(session({ role: 'analyst' }))),
      }),
    });
    await service.restore();
    advance(20 * 60_000);
    expect(await service.getAccessToken()).toEqual(err({ kind: 'signed-out' }));
    expect(store.value).toBeNull();
  });
});

describe('signOut (rule 10)', () => {
  it('revokes in the API without waiting and clears the device', async () => {
    let finish: () => void = () => undefined;
    const logout = vi.fn<AuthGateway['logout']>().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { service, store } = setup({ stored: session(), gateway: gateway({ logout }) });
    const listener = vi.fn();
    service.onSignedOut(listener);
    await service.restore();
    await service.signOut();
    expect(logout).toHaveBeenCalledWith('rt-1');
    expect(store.value).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    finish();
  });

  it('is harmless without a session, and listeners can unsubscribe', async () => {
    const { service, gw } = setup();
    const listener = vi.fn();
    const unsubscribe = service.onSignedOut(listener);
    unsubscribe();
    await service.signOut();
    expect(gw.logout).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
