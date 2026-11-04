import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  /** All sessions rotated from the same login share a family; reuse revokes the family. */
  readonly familyId: string;
  /** SHA-256 of the refresh token. The token itself is never stored. */
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly rotatedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export type SessionStatus = 'active' | 'expired' | 'rotated' | 'revoked';

/** One refresh token. Each refresh rotates it: the old one dies, a new one is born. */
export class Session {
  private constructor(private state: SessionSnapshot) {}

  static start(input: {
    id: string;
    organizationId: string;
    userId: string;
    familyId?: string;
    tokenHash: string;
    now: Date;
    ttlMs: number;
  }): Session {
    return new Session({
      id: input.id,
      organizationId: input.organizationId,
      userId: input.userId,
      familyId: input.familyId ?? input.id,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.now.getTime() + input.ttlMs),
      rotatedAt: null,
      revokedAt: null,
      createdAt: input.now,
    });
  }

  static fromSnapshot(snapshot: SessionSnapshot): Session {
    return new Session({ ...snapshot });
  }

  toSnapshot(): SessionSnapshot {
    return { ...this.state };
  }

  get id(): string {
    return this.state.id;
  }

  get userId(): string {
    return this.state.userId;
  }

  get familyId(): string {
    return this.state.familyId;
  }

  status(now: Date): SessionStatus {
    if (this.state.revokedAt !== null) {
      return 'revoked';
    }
    if (this.state.rotatedAt !== null) {
      return 'rotated';
    }
    return this.state.expiresAt <= now ? 'expired' : 'active';
  }

  rotate(input: {
    nextId: string;
    nextTokenHash: string;
    now: Date;
    ttlMs: number;
  }): Result<Session, 'INVALID_REFRESH_TOKEN' | 'REFRESH_TOKEN_REUSED'> {
    const status = this.status(input.now);
    if (status === 'rotated') {
      // Someone presented a token that was already exchanged: it was copied.
      return err('REFRESH_TOKEN_REUSED');
    }
    if (status !== 'active') {
      return err('INVALID_REFRESH_TOKEN');
    }
    this.state = { ...this.state, rotatedAt: input.now };
    return ok(
      Session.start({
        id: input.nextId,
        organizationId: this.state.organizationId,
        userId: this.state.userId,
        familyId: this.state.familyId,
        tokenHash: input.nextTokenHash,
        now: input.now,
        ttlMs: input.ttlMs,
      }),
    );
  }

  revoke(now: Date): void {
    if (this.state.revokedAt === null) {
      this.state = { ...this.state, revokedAt: now };
    }
  }
}
