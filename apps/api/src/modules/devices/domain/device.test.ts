import { describe, expect, it } from 'vitest';

import { Device } from './device.js';
import { Pairing } from './pairing.js';

const T0 = new Date('2026-11-06T12:00:00Z');
const T1 = new Date('2026-11-06T12:05:00Z');
const ORG = '0193a000-0000-7000-8000-0000000000a0';
const USER = '0193a000-0000-7000-8000-0000000000c9';

const device = () =>
  Device.pair({
    id: '0193a000-0000-7000-8000-0000000000d1',
    organizationId: ORG,
    nickname: ' Aparelho 1 ',
    platform: 'android',
    model: 'SM-X200',
    osVersion: '14',
    appVersion: '0.1.0',
    tokenHash: 'h',
    pairedAt: T0,
    pairedBy: USER,
  });

describe('Device', () => {
  it('starts active, seen when paired, with a trimmed nickname', () => {
    const d = device();
    expect(d.toSnapshot()).toMatchObject({
      nickname: 'Aparelho 1',
      lastSeenAt: T0,
      revokedAt: null,
      revokedBy: null,
    });
    expect(d.isActive).toBe(true);
    expect(Device.fromSnapshot(d.toSnapshot()).nickname).toBe('Aparelho 1');
  });

  it('renames, reporting whether it changed, and refuses bad nicknames', () => {
    const d = device();
    expect(d.rename('Tablet 03')).toEqual({ ok: true, value: true });
    expect(d.rename(' Tablet 03 ')).toEqual({ ok: true, value: false });
    expect(() => d.rename('x')).toThrow(TypeError);
  });

  it('is revoked once and then frozen', () => {
    const d = device();
    expect(d.revoke({ now: T1, by: USER })).toEqual({ ok: true, value: undefined });
    expect(d.isActive).toBe(false);
    expect(d.revoke({ now: T1, by: USER })).toEqual({ ok: false, error: 'DEVICE_REVOKED' });
    expect(d.rename('Tablet')).toEqual({ ok: false, error: 'DEVICE_REVOKED' });
  });

  it('records the last contact and app version', () => {
    const d = device();
    d.touch({ now: T1, appVersion: '0.2.0' });
    expect(d.toSnapshot()).toMatchObject({ lastSeenAt: T1, appVersion: '0.2.0' });
  });
});

describe('Pairing', () => {
  const pairing = () =>
    Pairing.create({
      id: '0193a000-0000-7000-8000-0000000000e1',
      organizationId: ORG,
      codeHash: 'c',
      createdBy: USER,
      createdAt: T0,
      expiresAt: new Date(T0.getTime() + 600_000),
    });

  it('is pending, then paired once', () => {
    const p = pairing();
    expect(p.status(T1)).toBe('pending');
    expect(p.consume({ deviceId: 'd', now: T1 })).toEqual({ ok: true, value: undefined });
    expect(p.status(T1)).toBe('paired');
    expect(p.deviceId).toBe('d');
    expect(p.consume({ deviceId: 'e', now: T1 })).toEqual({
      ok: false,
      error: 'PAIRING_CODE_INVALID',
    });
    expect(Pairing.fromSnapshot(p.toSnapshot()).status(T1)).toBe('paired');
  });

  it('expires after ten minutes', () => {
    const p = pairing();
    const later = new Date(T0.getTime() + 600_000);
    expect(p.status(later)).toBe('expired');
    expect(p.consume({ deviceId: 'd', now: later }).ok).toBe(false);
  });
});
