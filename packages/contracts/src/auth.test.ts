import { describe, expect, it } from 'vitest';

import {
  ChangePasswordRequest,
  LoginRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RefreshRequest,
} from './auth.js';

describe('LoginRequest', () => {
  it('normalizes the e-mail to trimmed lower case', () => {
    expect(LoginRequest.parse({ email: '  Matheus@AZ.com.br ', password: 'x' })).toEqual({
      email: 'matheus@az.com.br',
      password: 'x',
    });
  });

  it('does not apply the password policy at login (old passwords still log in)', () => {
    expect(LoginRequest.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
  });

  it.each([
    [{ email: 'not-an-email', password: 'x' }],
    [{ email: 'a@b.co', password: '' }],
    [{ email: 'a@b.co', password: 'x'.repeat(129) }],
    [{ email: 'a@b.co', password: 'x', extra: 'field' }],
    [{ email: 'a@b.co' }],
  ])('rejects %j', (input) => {
    expect(LoginRequest.safeParse(input).success).toBe(false);
  });
});

describe('password policy (new passwords)', () => {
  it('accepts 10 to 128 characters', () => {
    expect(
      PasswordResetConfirm.safeParse({ token: 't'.repeat(43), newPassword: 'x'.repeat(10) })
        .success,
    ).toBe(true);
    expect(
      ChangePasswordRequest.safeParse({ currentPassword: 'old', newPassword: 'x'.repeat(128) })
        .success,
    ).toBe(true);
  });

  it.each([['x'.repeat(9)], ['x'.repeat(129)]])(
    'rejects a password of length %#',
    (newPassword) => {
      expect(PasswordResetConfirm.safeParse({ token: 't'.repeat(43), newPassword }).success).toBe(
        false,
      );
    },
  );
});

describe('token fields', () => {
  it('requires refresh and reset tokens with a plausible length', () => {
    expect(RefreshRequest.safeParse({ refreshToken: 'short' }).success).toBe(false);
    expect(RefreshRequest.safeParse({ refreshToken: 'r'.repeat(43) }).success).toBe(true);
    expect(PasswordResetRequest.parse({ email: 'X@Y.COM' })).toEqual({ email: 'x@y.com' });
  });
});
