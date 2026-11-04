import { describe, expect, it } from 'vitest';

import { LOCK_DURATION_MS, MAX_FAILED_LOGINS, User } from './user.js';

const T0 = new Date('2026-11-04T12:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const ADMIN_ID = '0193a000-0000-7000-8000-0000000000a1';

const register = (overrides: Partial<Parameters<typeof User.register>[0]> = {}) =>
  User.register({
    id: ADMIN_ID,
    organizationId: '0193a000-0000-7000-8000-0000000000a0',
    name: '  Matheus Queiroz ',
    email: '  Matheus@AZ.com.br ',
    role: 'admin',
    passwordHash: 'hash-1',
    now: T0,
    ...overrides,
  });

describe('User.register', () => {
  it('normalizes name and e-mail and starts active, unlocked', () => {
    expect(register().toSnapshot()).toEqual({
      id: ADMIN_ID,
      organizationId: '0193a000-0000-7000-8000-0000000000a0',
      name: 'Matheus Queiroz',
      email: 'matheus@az.com.br',
      role: 'admin',
      status: 'active',
      passwordHash: 'hash-1',
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it.each([['not-an-email'], ['a@b'], ['']])('refuses the invalid e-mail %j', (email) => {
    expect(() => register({ email })).toThrow('Invalid e-mail');
  });

  it('refuses a name shorter than 2 characters', () => {
    expect(() => register({ name: ' x ' })).toThrow('Invalid name');
  });

  it('round-trips through a snapshot', () => {
    const user = register();
    expect(User.fromSnapshot(user.toSnapshot()).toSnapshot()).toEqual(user.toSnapshot());
  });
});

describe('login attempts and lockout', () => {
  it('allows login for an active, unlocked user', () => {
    expect(register().canAttemptLogin(T0)).toBe(true);
  });

  it(`locks the account for 15 minutes on the ${MAX_FAILED_LOGINS}th consecutive failure`, () => {
    const user = register();
    const results = Array.from({ length: MAX_FAILED_LOGINS }, (_, i) =>
      user.recordFailedLogin(at(i * 1000)),
    );

    expect(results.map((r) => r.locked)).toEqual([false, false, false, false, true]);
    expect(user.canAttemptLogin(at(5_000))).toBe(false);
    expect(user.canAttemptLogin(at(4_000 + LOCK_DURATION_MS - 1))).toBe(false);
    expect(user.canAttemptLogin(at(4_000 + LOCK_DURATION_MS))).toBe(true);
  });

  it('starts counting again after a lock expires (no instant re-lock)', () => {
    const user = register();
    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      user.recordFailedLogin(T0);
    }

    const afterLock = user.recordFailedLogin(at(LOCK_DURATION_MS + 1));

    expect(afterLock.locked).toBe(false);
    expect(user.toSnapshot().failedLoginAttempts).toBe(1);
    expect(user.toSnapshot().lockedUntil).toBeNull();
  });

  it('a successful login resets the failure counter and stamps lastLoginAt', () => {
    const user = register();
    user.recordFailedLogin(T0);
    user.recordFailedLogin(T0);

    user.recordSuccessfulLogin(at(10));

    expect(user.toSnapshot()).toMatchObject({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: at(10),
    });
  });

  it('never allows a disabled user to log in', () => {
    const user = register({ role: 'analyst' });
    expect(user.update({ status: 'disabled' }, { userId: ADMIN_ID + 'x' }, at(1)).ok).toBe(true);

    expect(user.canAttemptLogin(at(2))).toBe(false);
  });
});

describe('User.update', () => {
  const other = { userId: '0193a000-0000-7000-8000-0000000000ff' };

  it('changes name, role and status and stamps updatedAt', () => {
    const user = register({ role: 'coordinator' });

    const result = user.update(
      { name: ' Lucas Queiroz ', role: 'analyst', status: 'disabled' },
      other,
      at(5),
    );

    expect(result).toEqual({ ok: true, value: { changed: ['name', 'role', 'status'] } });
    expect(user.toSnapshot()).toMatchObject({
      name: 'Lucas Queiroz',
      role: 'analyst',
      status: 'disabled',
      updatedAt: at(5),
    });
  });

  it('reports only the fields that actually changed', () => {
    const user = register();

    expect(user.update({ name: 'Matheus Queiroz', role: 'admin' }, other, at(1))).toEqual({
      ok: true,
      value: { changed: [] },
    });
    expect(user.toSnapshot().updatedAt).toEqual(T0);
  });

  it('an admin cannot disable themself', () => {
    const user = register();

    expect(user.update({ status: 'disabled' }, { userId: ADMIN_ID }, at(1))).toEqual({
      ok: false,
      error: 'CANNOT_DISABLE_SELF',
    });
    expect(user.toSnapshot().status).toBe('active');
  });

  it('an admin cannot demote themself', () => {
    const user = register();

    expect(user.update({ role: 'coordinator' }, { userId: ADMIN_ID }, at(1))).toEqual({
      ok: false,
      error: 'CANNOT_DEMOTE_SELF',
    });
    expect(user.toSnapshot().role).toBe('admin');
  });

  it('re-enabling a user clears a pending lock', () => {
    const user = register({ role: 'analyst' });
    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      user.recordFailedLogin(T0);
    }
    user.update({ status: 'disabled' }, other, at(1));

    user.update({ status: 'active' }, other, at(2));

    expect(user.canAttemptLogin(at(3))).toBe(true);
  });

  it('refuses an invalid new name', () => {
    expect(() => register().update({ name: 'x' }, other, at(1))).toThrow('Invalid name');
  });
});

describe('User.changePassword', () => {
  it('replaces the hash and clears failures and locks', () => {
    const user = register();
    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      user.recordFailedLogin(T0);
    }

    user.changePassword('hash-2', at(1));

    expect(user.passwordHash).toBe('hash-2');
    expect(user.canAttemptLogin(at(2))).toBe(true);
    expect(user.toSnapshot().updatedAt).toEqual(at(1));
  });
});
