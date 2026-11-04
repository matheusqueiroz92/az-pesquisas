import { describe, expect, it } from 'vitest';

import { Session } from './session.js';

const T0 = new Date('2026-11-04T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(T0.getTime() + ms);

const start = () =>
  Session.start({
    id: 's1',
    organizationId: 'o1',
    userId: 'u1',
    tokenHash: 'h1',
    now: T0,
    ttlMs: 30 * DAY,
  });

describe('Session', () => {
  it('starts active, in a new family named after itself', () => {
    const session = start();

    expect(session.toSnapshot()).toEqual({
      id: 's1',
      organizationId: 'o1',
      userId: 'u1',
      familyId: 's1',
      tokenHash: 'h1',
      expiresAt: at(30 * DAY),
      rotatedAt: null,
      revokedAt: null,
      createdAt: T0,
    });
    expect(session.status(T0)).toBe('active');
  });

  it('expires after its ttl', () => {
    expect(start().status(at(30 * DAY - 1))).toBe('active');
    expect(start().status(at(30 * DAY))).toBe('expired');
  });

  it('rotation marks the old session and returns a new one in the same family', () => {
    const session = start();

    const result = session.rotate({
      nextId: 's2',
      nextTokenHash: 'h2',
      now: at(DAY),
      ttlMs: 30 * DAY,
    });

    expect(result.ok).toBe(true);
    const next = result.ok ? result.value : undefined;
    expect(session.status(at(DAY))).toBe('rotated');
    expect(next?.toSnapshot()).toMatchObject({
      id: 's2',
      familyId: 's1',
      tokenHash: 'h2',
      userId: 'u1',
      organizationId: 'o1',
      expiresAt: at(31 * DAY),
    });
  });

  it('using a rotated session again is reported as reuse', () => {
    const session = start();
    session.rotate({ nextId: 's2', nextTokenHash: 'h2', now: at(1), ttlMs: DAY });

    expect(session.rotate({ nextId: 's3', nextTokenHash: 'h3', now: at(2), ttlMs: DAY })).toEqual({
      ok: false,
      error: 'REFRESH_TOKEN_REUSED',
    });
  });

  it.each([
    ['expired', (s: Session) => s, at(31 * DAY)],
    [
      'revoked',
      (s: Session) => {
        s.revoke(at(1));
        return s;
      },
      at(2),
    ],
  ])('a %s session cannot rotate', (_case, prepare, now) => {
    expect(prepare(start()).rotate({ nextId: 's2', nextTokenHash: 'h2', now, ttlMs: DAY })).toEqual(
      { ok: false, error: 'INVALID_REFRESH_TOKEN' },
    );
  });

  it('revocation wins over rotation and keeps the first revocation time', () => {
    const session = start();
    session.rotate({ nextId: 's2', nextTokenHash: 'h2', now: at(1), ttlMs: DAY });
    session.revoke(at(2));
    session.revoke(at(3));

    expect(session.status(at(4))).toBe('revoked');
    expect(session.toSnapshot().revokedAt).toEqual(at(2));
  });

  it('round-trips through a snapshot', () => {
    const session = start();
    expect(Session.fromSnapshot(session.toSnapshot()).toSnapshot()).toEqual(session.toSnapshot());
  });
});
