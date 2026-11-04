import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export interface PasswordResetSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  /** SHA-256 of the token sent by e-mail. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
  readonly createdAt: Date;
}

/** A single-use "forgot my password" link, valid for 30 minutes. */
export class PasswordReset {
  private constructor(private state: PasswordResetSnapshot) {}

  static issue(input: {
    id: string;
    organizationId: string;
    userId: string;
    tokenHash: string;
    now: Date;
  }): PasswordReset {
    return new PasswordReset({
      id: input.id,
      organizationId: input.organizationId,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + PASSWORD_RESET_TTL_MS),
      usedAt: null,
      createdAt: input.now,
    });
  }

  static fromSnapshot(snapshot: PasswordResetSnapshot): PasswordReset {
    return new PasswordReset({ ...snapshot });
  }

  toSnapshot(): PasswordResetSnapshot {
    return { ...this.state };
  }

  consume(now: Date): Result<{ userId: string }, 'INVALID_RESET_TOKEN'> {
    if (this.state.usedAt !== null || this.state.expiresAt <= now) {
      return err('INVALID_RESET_TOKEN');
    }
    this.state = { ...this.state, usedAt: now };
    return ok({ userId: this.state.userId });
  }
}
