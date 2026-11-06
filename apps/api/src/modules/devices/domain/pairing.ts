import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

export interface PairingSnapshot {
  readonly id: string;
  readonly organizationId: string;
  /** SHA-256 of the 6-digit code (rule 10). */
  readonly codeHash: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly deviceId: string | null;
  readonly consumedAt: Date | null;
}

export type PairingStatus = 'pending' | 'paired' | 'expired';

/** A one-time code that links a device to the organization (spec 016 rule 2). */
export class Pairing {
  private constructor(private state: PairingSnapshot) {}

  static create(input: Omit<PairingSnapshot, 'deviceId' | 'consumedAt'>): Pairing {
    return new Pairing({ ...input, deviceId: null, consumedAt: null });
  }

  static fromSnapshot(snapshot: PairingSnapshot): Pairing {
    return new Pairing({ ...snapshot });
  }

  toSnapshot(): PairingSnapshot {
    return { ...this.state };
  }

  get id(): string {
    return this.state.id;
  }

  get deviceId(): string | null {
    return this.state.deviceId;
  }

  status(now: Date): PairingStatus {
    if (this.state.consumedAt) {
      return 'paired';
    }
    return now < this.state.expiresAt ? 'pending' : 'expired';
  }

  /** Used once, before it expires; every failure looks the same to the app (rule 4). */
  consume(input: { deviceId: string; now: Date }): Result<void, 'PAIRING_CODE_INVALID'> {
    if (this.status(input.now) !== 'pending') {
      return err('PAIRING_CODE_INVALID');
    }
    this.state = { ...this.state, deviceId: input.deviceId, consumedAt: input.now };
    return ok(undefined);
  }
}
