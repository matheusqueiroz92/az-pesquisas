import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import type { GatewayError } from './ports';

/** What this installation knows about its link with the organization (spec 016). */
export interface PairedDevice {
  readonly deviceId: string;
  /** Long-lived; lives only in the secure store. */
  readonly deviceToken: string;
  readonly organization: { readonly id: string; readonly name: string };
}

export interface DeviceInfo {
  readonly platform: 'android' | 'ios';
  readonly model: string;
  readonly osVersion: string;
  readonly appVersion: string;
}

export interface DeviceGateway {
  readonly pair: (code: string, device: DeviceInfo) => Promise<Result<PairedDevice, GatewayError>>;
  readonly heartbeat: (
    deviceToken: string,
    appVersion: string,
  ) => Promise<Result<void, GatewayError>>;
}

export interface DeviceStore {
  readonly load: () => Promise<PairedDevice | null>;
  readonly save: (device: PairedDevice) => Promise<void>;
  readonly clear: () => Promise<void>;
}

export type PairError =
  | { readonly kind: 'invalid-code' }
  | { readonly kind: 'rate-limited' }
  | { readonly kind: 'offline' }
  | { readonly kind: 'server' };

/** What the API said about this device the last time it could be reached. */
export type DeviceCheck = 'unpaired' | 'ok' | 'revoked' | 'offline';

/** Digits only: people type "123 456" or "123-456". */
export const normalizePairingCode = (input: string): string | null => {
  const digits = input.replace(/[\s-]/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
};

export const createDeviceService = (deps: {
  gateway: DeviceGateway;
  store: DeviceStore;
  info: DeviceInfo;
}) => ({
  current: (): Promise<PairedDevice | null> => deps.store.load(),

  /** Redeems the 6-digit code shown in the panel (spec 016 rule 3). */
  pair: async (input: string): Promise<Result<PairedDevice, PairError>> => {
    const code = normalizePairingCode(input);
    if (code === null) {
      return err({ kind: 'invalid-code' });
    }
    const paired = await deps.gateway.pair(code, deps.info);
    if (!paired.ok) {
      const failure = paired.error;
      if (failure.kind === 'offline') {
        return err({ kind: 'offline' });
      }
      if (failure.kind === 'rejected' && failure.status === 429) {
        return err({ kind: 'rate-limited' });
      }
      return err(failure.kind === 'rejected' ? { kind: 'invalid-code' } : { kind: 'server' });
    }
    await deps.store.save(paired.value);
    return ok(paired.value);
  },

  /**
   * Tells the API the app is alive. A device revoked in the panel forgets its
   * token and must be paired again (spec 016 rule 8).
   */
  check: async (): Promise<DeviceCheck> => {
    const device = await deps.store.load();
    if (!device) {
      return 'unpaired';
    }
    const result = await deps.gateway.heartbeat(device.deviceToken, deps.info.appVersion);
    if (result.ok) {
      return 'ok';
    }
    if (result.error.kind === 'rejected' && result.error.status === 401) {
      await deps.store.clear();
      return 'revoked';
    }
    // Offline or a server hiccup: keep working offline, try again next time.
    return 'offline';
  },
});

export type DeviceService = ReturnType<typeof createDeviceService>;
