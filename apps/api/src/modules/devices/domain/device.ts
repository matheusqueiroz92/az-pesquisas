import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';
import type { DevicePlatform } from '@az-pesquisas/contracts';

export interface DeviceSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly nickname: string;
  readonly platform: DevicePlatform;
  readonly model: string;
  readonly osVersion: string;
  readonly appVersion: string;
  /** SHA-256 of the device token; the token itself is never stored (rule 10). */
  readonly tokenHash: string;
  readonly pairedAt: Date;
  readonly pairedBy: string;
  readonly lastSeenAt: Date;
  readonly revokedAt: Date | null;
  readonly revokedBy: string | null;
}

const normalizeNickname = (raw: string): string => {
  const nickname = raw.trim();
  if (nickname.length < 2 || nickname.length > 60) {
    throw new TypeError('Invalid device nickname');
  }
  return nickname;
};

/** A tablet or phone of the organization (spec 016). */
export class Device {
  private constructor(private state: DeviceSnapshot) {}

  static pair(input: Omit<DeviceSnapshot, 'lastSeenAt' | 'revokedAt' | 'revokedBy'>): Device {
    return new Device({
      ...input,
      nickname: normalizeNickname(input.nickname),
      lastSeenAt: input.pairedAt,
      revokedAt: null,
      revokedBy: null,
    });
  }

  static fromSnapshot(snapshot: DeviceSnapshot): Device {
    return new Device({ ...snapshot });
  }

  toSnapshot(): DeviceSnapshot {
    return { ...this.state };
  }

  get id(): string {
    return this.state.id;
  }

  get nickname(): string {
    return this.state.nickname;
  }

  get isActive(): boolean {
    return this.state.revokedAt === null;
  }

  rename(nickname: string): Result<boolean, 'DEVICE_REVOKED'> {
    if (!this.isActive) {
      return err('DEVICE_REVOKED');
    }
    const next = normalizeNickname(nickname);
    const changed = next !== this.state.nickname;
    this.state = { ...this.state, nickname: next };
    return ok(changed);
  }

  /** Invalidates the token for good (spec 016 rule 8). */
  revoke(input: { now: Date; by: string }): Result<void, 'DEVICE_REVOKED'> {
    if (!this.isActive) {
      return err('DEVICE_REVOKED');
    }
    this.state = { ...this.state, revokedAt: input.now, revokedBy: input.by };
    return ok(undefined);
  }

  /** The app talked to the API (spec 016 rule 9). */
  touch(input: { now: Date; appVersion: string }): void {
    this.state = { ...this.state, lastSeenAt: input.now, appVersion: input.appVersion };
  }
}
