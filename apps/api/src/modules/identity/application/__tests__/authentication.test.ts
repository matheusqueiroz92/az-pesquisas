import { beforeEach, describe, expect, it } from 'vitest';

import { LOCK_DURATION_MS, MAX_FAILED_LOGINS } from '../../domain/user.js';
import { getMe, login, logout, refreshSession } from '../authentication.js';
import { updateUser } from '../user-management.js';
import { createFakes } from './fakes.js';
import type { Fakes } from './fakes.js';
import {
  addUser,
  ADMIN_PASSWORD,
  inTenant,
  loginAs,
  setupOrganization,
  USER_PASSWORD,
} from './helpers.js';
import type { Actor } from '../ports.js';

let fakes: Fakes;
let admin: Actor;

beforeEach(async () => {
  fakes = createFakes();
  admin = await setupOrganization(fakes, 'az');
});

describe('login', () => {
  it('CA-01: returns tokens and the user, with the e-mail in any case', async () => {
    const result = await login(fakes.deps, { email: '  ADMIN@AZ.com ', password: ADMIN_PASSWORD });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.user).toEqual({
      id: admin.userId,
      organizationId: admin.organizationId,
      name: 'Admin az',
      email: 'admin@az.com',
      role: 'admin',
    });
    expect(result.value.accessTokenExpiresAt).toEqual(new Date('2026-11-04T12:15:00Z'));
    expect(result.value.refreshTokenExpiresAt).toEqual(new Date('2026-12-04T12:00:00Z'));
  });

  it('stores only the hash of the refresh token', async () => {
    const result = await login(fakes.deps, { email: 'admin@az.com', password: ADMIN_PASSWORD });
    const token = result.ok ? result.value.refreshToken : '';

    const stored = [...fakes.tables.sessions.rows.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toBe(fakes.deps.tokens.hash(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('records login.succeeded in the audit log of the organization', async () => {
    await login(fakes.deps, { email: 'admin@az.com', password: ADMIN_PASSWORD });

    expect(fakes.auditEntries.at(-1)).toMatchObject({
      organizationId: admin.organizationId,
      action: 'login.succeeded',
      actorUserId: admin.userId,
    });
  });

  describe('CA-02: every failure looks the same', () => {
    it('wrong password', async () => {
      expect(await login(fakes.deps, { email: 'admin@az.com', password: 'errada' })).toEqual({
        ok: false,
        error: 'INVALID_CREDENTIALS',
      });
      expect(fakes.auditEntries.at(-1)).toMatchObject({ action: 'login.failed' });
    });

    it('unknown e-mail, still spending a password verification (timing)', async () => {
      const before = fakes.hashCalls.verify;

      expect(await login(fakes.deps, { email: 'ninguem@az.com', password: 'x' })).toEqual({
        ok: false,
        error: 'INVALID_CREDENTIALS',
      });
      expect(fakes.hashCalls.verify).toBe(before + 1);
    });

    it('disabled account, even with the right password', async () => {
      const userId = await addUser(fakes, admin, 'analyst', 'analista@az.com');
      await updateUser(fakes.deps, admin, userId, { status: 'disabled' });
      const before = fakes.hashCalls.verify;

      expect(
        await login(fakes.deps, { email: 'analista@az.com', password: USER_PASSWORD }),
      ).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
      expect(fakes.hashCalls.verify).toBe(before + 1);
    });
  });

  it('CA-03: locks after 5 wrong passwords, also for the right one, for 15 minutes', async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      await login(fakes.deps, { email: 'admin@az.com', password: 'errada' });
    }

    const whileLocked = await login(fakes.deps, {
      email: 'admin@az.com',
      password: ADMIN_PASSWORD,
    });
    fakes.advance(LOCK_DURATION_MS);
    const afterLock = await login(fakes.deps, { email: 'admin@az.com', password: ADMIN_PASSWORD });

    expect(whileLocked).toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
    expect(afterLock.ok).toBe(true);
    expect(fakes.auditEntries.filter((e) => e.action === 'account.locked')).toHaveLength(1);
  });
});

describe('refreshSession', () => {
  it('rotates: returns a new pair and the old refresh token stops working', async () => {
    const { tokens } = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);
    fakes.advance(60_000);

    const rotated = await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken });

    expect(rotated.ok).toBe(true);
    const next = rotated.ok ? rotated.value : undefined;
    expect(next?.refreshToken).not.toBe(tokens.refreshToken);
    expect(next?.user.id).toBe(admin.userId);
  });

  it('CA-04: reusing an exchanged token revokes the whole session (also the new token)', async () => {
    const { tokens } = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);
    const legit = await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken });
    const legitToken = legit.ok ? legit.value.refreshToken : '';

    const stolen = await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken });
    const afterTheft = await refreshSession(fakes.deps, { refreshToken: legitToken });

    expect(stolen).toEqual({ ok: false, error: 'INVALID_REFRESH_TOKEN' });
    expect(afterTheft).toEqual({ ok: false, error: 'INVALID_REFRESH_TOKEN' });
    expect(fakes.auditEntries.map((e) => e.action)).toContain('session.reuse_detected');
  });

  it('rejects unknown and expired tokens', async () => {
    const { tokens } = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);

    expect(await refreshSession(fakes.deps, { refreshToken: 'nao-existe'.repeat(5) })).toEqual({
      ok: false,
      error: 'INVALID_REFRESH_TOKEN',
    });
    fakes.advance(31 * 24 * 60 * 60 * 1000);
    expect(await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken })).toEqual({
      ok: false,
      error: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('refuses to refresh for a user disabled meanwhile', async () => {
    const userId = await addUser(fakes, admin, 'analyst', 'analista@az.com');
    const { tokens } = await loginAs(fakes, 'analista@az.com', USER_PASSWORD);
    await updateUser(fakes.deps, admin, userId, { status: 'disabled' });

    expect(await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken })).toEqual({
      ok: false,
      error: 'INVALID_REFRESH_TOKEN',
    });
  });
});

describe('logout', () => {
  it('CA-05: the refresh token stops working', async () => {
    const { tokens } = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);

    await logout(fakes.deps, { refreshToken: tokens.refreshToken });

    expect(await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken })).toEqual({
      ok: false,
      error: 'INVALID_REFRESH_TOKEN',
    });
  });

  it('is silent for an unknown token', async () => {
    await expect(logout(fakes.deps, { refreshToken: 'x'.repeat(43) })).resolves.toBeUndefined();
  });
});

describe('getMe', () => {
  it('returns the acting user', async () => {
    const { actor } = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);

    expect(await inTenant(actor, () => getMe(fakes.deps, actor))).toEqual({
      ok: true,
      value: {
        id: admin.userId,
        organizationId: admin.organizationId,
        name: 'Admin az',
        email: 'admin@az.com',
        role: 'admin',
      },
    });
  });

  it('reports USER_NOT_FOUND for a token of a user that no longer exists', async () => {
    const ghost: Actor = { ...admin, userId: '0193a000-0000-7000-8000-00000000dead' };

    expect(await getMe(fakes.deps, ghost)).toEqual({ ok: false, error: 'USER_NOT_FOUND' });
  });
});
