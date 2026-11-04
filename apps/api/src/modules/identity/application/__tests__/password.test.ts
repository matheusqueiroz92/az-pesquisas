import { beforeEach, describe, expect, it } from 'vitest';

import { PASSWORD_RESET_TTL_MS } from '../../domain/password-reset.js';
import { login, refreshSession } from '../authentication.js';
import { changePassword, confirmPasswordReset, requestPasswordReset } from '../password.js';
import { updateUser } from '../user-management.js';
import { createFakes } from './fakes.js';
import type { Fakes } from './fakes.js';
import { addUser, ADMIN_PASSWORD, loginAs, setupOrganization, USER_PASSWORD } from './helpers.js';
import type { Actor } from '../ports.js';

let fakes: Fakes;
let admin: Actor;

const NEW_PASSWORD = 'uma-senha-nova-456';

/** The token is only in the e-mail: extract it from the link. */
const tokenFromMail = (fakesRef: Fakes): string => {
  const text = fakesRef.sentMail.at(-1)?.text ?? '';
  const match = /token=([A-Za-z0-9_-]+)/.exec(text);
  if (!match?.[1]) {
    throw new Error('no reset link in the e-mail');
  }
  return match[1];
};

beforeEach(async () => {
  fakes = createFakes();
  admin = await setupOrganization(fakes, 'az');
});

describe('requestPasswordReset', () => {
  it('sends a single-use link to an existing, active user', async () => {
    await requestPasswordReset(fakes.deps, { email: 'Admin@AZ.com' });

    expect(fakes.sentMail).toHaveLength(1);
    expect(fakes.sentMail[0]?.to).toBe('admin@az.com');
    expect(fakes.sentMail[0]?.text).toContain('https://painel.example.com/redefinir-senha?token=');
    const stored = [...fakes.tables.resets.rows.values()];
    expect(stored[0]?.tokenHash).toBe(fakes.deps.tokens.hash(tokenFromMail(fakes)));
    expect(fakes.auditEntries.at(-1)).toMatchObject({ action: 'password.reset_requested' });
  });

  it('does nothing visible for an unknown e-mail', async () => {
    await expect(
      requestPasswordReset(fakes.deps, { email: 'ninguem@az.com' }),
    ).resolves.toBeUndefined();
    expect(fakes.sentMail).toHaveLength(0);
  });

  it('does not send a link to a disabled user', async () => {
    const userId = await addUser(fakes, admin, 'analyst', 'analista@az.com');
    await updateUser(fakes.deps, admin, userId, { status: 'disabled' });

    await requestPasswordReset(fakes.deps, { email: 'analista@az.com' });

    expect(fakes.sentMail).toHaveLength(0);
  });
});

describe('confirmPasswordReset', () => {
  it('CA-06: changes the password, works once and revokes old sessions', async () => {
    const { tokens } = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);
    await requestPasswordReset(fakes.deps, { email: 'admin@az.com' });
    const token = tokenFromMail(fakes);

    const first = await confirmPasswordReset(fakes.deps, { token, newPassword: NEW_PASSWORD });
    const second = await confirmPasswordReset(fakes.deps, {
      token,
      newPassword: 'outra-senha-789',
    });

    expect(first).toEqual({ ok: true, value: undefined });
    expect(second).toEqual({ ok: false, error: 'INVALID_RESET_TOKEN' });
    expect((await login(fakes.deps, { email: 'admin@az.com', password: ADMIN_PASSWORD })).ok).toBe(
      false,
    );
    expect((await login(fakes.deps, { email: 'admin@az.com', password: NEW_PASSWORD })).ok).toBe(
      true,
    );
    expect((await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken })).ok).toBe(
      false,
    );
    expect(fakes.auditEntries.map((e) => e.action)).toContain('password.reset_completed');
  });

  it('CA-06: refuses an expired link', async () => {
    await requestPasswordReset(fakes.deps, { email: 'admin@az.com' });
    fakes.advance(PASSWORD_RESET_TTL_MS);

    expect(
      await confirmPasswordReset(fakes.deps, {
        token: tokenFromMail(fakes),
        newPassword: NEW_PASSWORD,
      }),
    ).toEqual({ ok: false, error: 'INVALID_RESET_TOKEN' });
  });

  it('refuses an unknown token', async () => {
    expect(
      await confirmPasswordReset(fakes.deps, { token: 'x'.repeat(43), newPassword: NEW_PASSWORD }),
    ).toEqual({ ok: false, error: 'INVALID_RESET_TOKEN' });
  });

  it('refuses the link of a user disabled after asking for it', async () => {
    const userId = await addUser(fakes, admin, 'analyst', 'analista@az.com');
    await requestPasswordReset(fakes.deps, { email: 'analista@az.com' });
    await updateUser(fakes.deps, admin, userId, { status: 'disabled' });

    expect(
      await confirmPasswordReset(fakes.deps, {
        token: tokenFromMail(fakes),
        newPassword: NEW_PASSWORD,
      }),
    ).toEqual({ ok: false, error: 'INVALID_RESET_TOKEN' });
  });
});

describe('changePassword', () => {
  it('requires the current password', async () => {
    const { actor } = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);

    expect(
      await changePassword(fakes.deps, actor, {
        currentPassword: 'errada',
        newPassword: NEW_PASSWORD,
      }),
    ).toEqual({ ok: false, error: 'INVALID_CURRENT_PASSWORD' });
  });

  it('keeps the current session and revokes the others', async () => {
    const otherDevice = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);
    const current = await loginAs(fakes, 'admin@az.com', ADMIN_PASSWORD);

    const result = await changePassword(fakes.deps, current.actor, {
      currentPassword: ADMIN_PASSWORD,
      newPassword: NEW_PASSWORD,
    });

    expect(result).toEqual({ ok: true, value: undefined });
    expect(
      (await refreshSession(fakes.deps, { refreshToken: current.tokens.refreshToken })).ok,
    ).toBe(true);
    expect(
      (await refreshSession(fakes.deps, { refreshToken: otherDevice.tokens.refreshToken })).ok,
    ).toBe(false);
    expect(fakes.auditEntries.map((e) => e.action)).toContain('password.changed');
  });

  it('reports USER_NOT_FOUND for a vanished user', async () => {
    const ghost: Actor = { ...admin, userId: '0193a000-0000-7000-8000-00000000dead' };

    expect(
      await changePassword(fakes.deps, ghost, {
        currentPassword: USER_PASSWORD,
        newPassword: NEW_PASSWORD,
      }),
    ).toEqual({ ok: false, error: 'USER_NOT_FOUND' });
  });
});
