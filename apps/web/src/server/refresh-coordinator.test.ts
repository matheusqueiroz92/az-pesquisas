import { describe, expect, it } from 'vitest';

import { createRefreshCoordinator } from './refresh-coordinator';
import type { RefreshOutcome } from './refresh-coordinator';

const tokens = (n: number) => ({
  accessToken: `at-${n}`,
  accessTokenExpiresAt: '2026-11-04T12:15:00.000Z',
  refreshToken: `rt-${n}`,
  refreshTokenExpiresAt: '2026-12-04T12:00:00.000Z',
});

/** A fake API: counts calls and resolves only when told to. */
const fakeApi = () => {
  const calls: string[] = [];
  const pending: ((outcome: RefreshOutcome) => void)[] = [];
  return {
    calls,
    refresh: (refreshToken: string) => {
      calls.push(refreshToken);
      return new Promise<RefreshOutcome>((resolve) => pending.push(resolve));
    },
    answer: (outcome: RefreshOutcome) => {
      pending.shift()?.(outcome);
    },
  };
};

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('refresh coordinator (spec 007, rule 4)', () => {
  it('CA-04: concurrent requests with the same refresh token make ONE call to the API', async () => {
    const api = fakeApi();
    const coordinator = createRefreshCoordinator({ refresh: api.refresh });

    const three = Promise.all([
      coordinator.refresh('rt-0'),
      coordinator.refresh('rt-0'),
      coordinator.refresh('rt-0'),
    ]);
    await tick();
    api.answer({ ok: true, tokens: tokens(1) });

    expect(await three).toEqual([
      { ok: true, tokens: tokens(1) },
      { ok: true, tokens: tokens(1) },
      { ok: true, tokens: tokens(1) },
    ]);
    expect(api.calls).toEqual(['rt-0']);
  });

  it('a request arriving right after, still with the old token, gets the cached result', async () => {
    const api = fakeApi();
    let now = 1_000_000;
    const coordinator = createRefreshCoordinator({ refresh: api.refresh, now: () => now });

    const first = coordinator.refresh('rt-0');
    await tick();
    api.answer({ ok: true, tokens: tokens(1) });
    await first;
    now += 29_000;

    expect(await coordinator.refresh('rt-0')).toEqual({ ok: true, tokens: tokens(1) });
    expect(api.calls).toEqual(['rt-0']);
  });

  it('after the grace period the old token goes to the API again (and the API decides)', async () => {
    const api = fakeApi();
    let now = 1_000_000;
    const coordinator = createRefreshCoordinator({ refresh: api.refresh, now: () => now });

    const first = coordinator.refresh('rt-0');
    await tick();
    api.answer({ ok: true, tokens: tokens(1) });
    await first;
    now += 30_001;
    const late = coordinator.refresh('rt-0');
    await tick();
    api.answer({ ok: false });

    expect(await late).toEqual({ ok: false });
    expect(api.calls).toEqual(['rt-0', 'rt-0']);
  });

  it('different refresh tokens (different people) never share a result', async () => {
    const api = fakeApi();
    const coordinator = createRefreshCoordinator({ refresh: api.refresh });

    const a = coordinator.refresh('rt-a');
    const b = coordinator.refresh('rt-b');
    await tick();
    api.answer({ ok: true, tokens: tokens(1) });
    api.answer({ ok: true, tokens: tokens(2) });

    expect((await a).ok && (await b).ok).toBe(true);
    expect(api.calls).toEqual(['rt-a', 'rt-b']);
    const [ra, rb] = [await a, await b];
    expect(ra.ok && rb.ok && ra.tokens.accessToken !== rb.tokens.accessToken).toBe(true);
  });

  it('a network failure is not cached: the next request tries again', async () => {
    let attempt = 0;
    const coordinator = createRefreshCoordinator({
      refresh: () => {
        attempt += 1;
        return attempt === 1
          ? Promise.reject(new Error('ECONNREFUSED'))
          : Promise.resolve({ ok: true, tokens: tokens(9) });
      },
    });

    await expect(coordinator.refresh('rt-0')).rejects.toThrow('ECONNREFUSED');
    expect(await coordinator.refresh('rt-0')).toEqual({ ok: true, tokens: tokens(9) });
  });

  it('forgets expired entries, so memory does not grow with every login', async () => {
    let now = 0;
    const coordinator = createRefreshCoordinator({
      refresh: (rt) =>
        Promise.resolve({ ok: true, tokens: { ...tokens(0), refreshToken: `${rt}-next` } }),
      now: () => now,
    });

    for (let i = 0; i < 100; i += 1) {
      await coordinator.refresh(`rt-${i}`);
    }
    now += 31_000;
    await coordinator.refresh('rt-new');

    expect(coordinator.size()).toBe(1);
  });

  it('keys by a hash: raw refresh tokens are not kept as map keys', async () => {
    const coordinator = createRefreshCoordinator({
      refresh: () => Promise.resolve({ ok: false }),
    });

    await coordinator.refresh('super-secret-refresh-token');

    expect(coordinator.keys().join(',')).not.toContain('super-secret');
  });
});
