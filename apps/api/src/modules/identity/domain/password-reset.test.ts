import { describe, expect, it } from 'vitest';

import { PASSWORD_RESET_TTL_MS, PasswordReset } from './password-reset.js';

const T0 = new Date('2026-11-04T12:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const issue = () =>
  PasswordReset.issue({ id: 'r1', organizationId: 'o1', userId: 'u1', tokenHash: 'h', now: T0 });

describe('PasswordReset', () => {
  it('is valid for 30 minutes', () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(30 * 60 * 1000);
    expect(issue().toSnapshot()).toEqual({
      id: 'r1',
      organizationId: 'o1',
      userId: 'u1',
      tokenHash: 'h',
      expiresAt: at(PASSWORD_RESET_TTL_MS),
      usedAt: null,
      createdAt: T0,
    });
  });

  it('can be consumed once, before it expires', () => {
    const reset = issue();

    expect(reset.consume(at(1000))).toEqual({ ok: true, value: { userId: 'u1' } });
    expect(reset.consume(at(2000))).toEqual({ ok: false, error: 'INVALID_RESET_TOKEN' });
    expect(reset.toSnapshot().usedAt).toEqual(at(1000));
  });

  it('cannot be consumed after it expires', () => {
    expect(issue().consume(at(PASSWORD_RESET_TTL_MS))).toEqual({
      ok: false,
      error: 'INVALID_RESET_TOKEN',
    });
  });

  it('round-trips through a snapshot', () => {
    const reset = issue();
    expect(PasswordReset.fromSnapshot(reset.toSnapshot()).toSnapshot()).toEqual(reset.toSnapshot());
  });
});
