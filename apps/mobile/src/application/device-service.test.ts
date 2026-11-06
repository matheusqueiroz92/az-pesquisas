import { err, ok } from '@az-pesquisas/core';
import { describe, expect, it, vi } from 'vitest';

import { createDeviceService, normalizePairingCode } from './device-service';
import type { DeviceGateway, DeviceStore, PairedDevice } from './device-service';

const PAIRED: PairedDevice = {
  deviceId: 'dev-1',
  deviceToken: 'tok',
  organization: { id: 'org-1', name: 'Instituto AZ' },
};
const INFO = {
  platform: 'android',
  model: 'Moto G',
  osVersion: '14',
  appVersion: '0.1.0',
} as const;

const setup = (initial: PairedDevice | null = null) => {
  let stored = initial;
  const store: DeviceStore = {
    load: vi.fn(() => Promise.resolve(stored)),
    save: vi.fn((device: PairedDevice) => {
      stored = device;
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      stored = null;
      return Promise.resolve();
    }),
  };
  const gateway = {
    pair: vi.fn<DeviceGateway['pair']>(),
    heartbeat: vi.fn<DeviceGateway['heartbeat']>(),
  };
  return {
    service: createDeviceService({ gateway, store, info: INFO }),
    gateway,
    store,
    stored: () => stored,
  };
};

describe('normalizePairingCode', () => {
  it.each([
    ['123456', '123456'],
    [' 123 456 ', '123456'],
    ['123-456', '123456'],
    ['12345', null],
    ['12345a', null],
    ['1234567', null],
  ])('%s → %s', (input, expected) => {
    expect(normalizePairingCode(input)).toBe(expected);
  });
});

describe('DeviceService.pair', () => {
  it('redeems the code and keeps the token in the secure store', async () => {
    const { service, gateway, stored } = setup();
    gateway.pair.mockResolvedValue(ok(PAIRED));
    expect(await service.pair('123 456')).toEqual(ok(PAIRED));
    expect(gateway.pair).toHaveBeenCalledWith('123456', INFO);
    expect(stored()).toEqual(PAIRED);
  });

  it('refuses a malformed code without calling the API', async () => {
    const { service, gateway } = setup();
    expect(await service.pair('12')).toEqual(err({ kind: 'invalid-code' }));
    expect(gateway.pair).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'rejected', status: 422, code: 'PAIRING_CODE_INVALID' } as const, 'invalid-code'],
    [{ kind: 'rejected', status: 429, code: undefined } as const, 'rate-limited'],
    [{ kind: 'offline' } as const, 'offline'],
    [{ kind: 'server', status: 500 } as const, 'server'],
  ])('maps %o to %s and stores nothing', async (failure, kind) => {
    const { service, gateway, stored } = setup();
    gateway.pair.mockResolvedValue(err(failure));
    expect(await service.pair('123456')).toEqual(err({ kind }));
    expect(stored()).toBeNull();
  });
});

describe('DeviceService.check', () => {
  it('is unpaired without a stored device', async () => {
    const { service, gateway } = setup();
    expect(await service.check()).toBe('unpaired');
    expect(gateway.heartbeat).not.toHaveBeenCalled();
  });

  it('sends the heartbeat with the stored token', async () => {
    const { service, gateway } = setup(PAIRED);
    gateway.heartbeat.mockResolvedValue(ok(undefined));
    expect(await service.check()).toBe('ok');
    expect(gateway.heartbeat).toHaveBeenCalledWith('tok', '0.1.0');
  });

  it('forgets a revoked device (401)', async () => {
    const { service, gateway, stored } = setup(PAIRED);
    gateway.heartbeat.mockResolvedValue(
      err({ kind: 'rejected', status: 401, code: 'DEVICE_TOKEN_INVALID' }),
    );
    expect(await service.check()).toBe('revoked');
    expect(stored()).toBeNull();
  });

  it('keeps the pairing when offline or on server errors', async () => {
    const { service, gateway, stored } = setup(PAIRED);
    gateway.heartbeat.mockResolvedValueOnce(err({ kind: 'offline' }));
    expect(await service.check()).toBe('offline');
    gateway.heartbeat.mockResolvedValueOnce(err({ kind: 'server', status: 502 }));
    expect(await service.check()).toBe('offline');
    expect(stored()).toEqual(PAIRED);
  });
});
