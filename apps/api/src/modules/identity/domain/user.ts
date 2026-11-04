import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';
import type { Role, UserStatus } from '@az-pesquisas/contracts';

export const MAX_FAILED_LOGINS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

// Defensive check: the HTTP layer already validates with Zod, but the aggregate
// must never hold an invalid e-mail, whoever calls it (seed command, future imports).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (raw: string): string => {
  const email = raw.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    throw new TypeError('Invalid e-mail');
  }
  return email;
};

const normalizeName = (raw: string): string => {
  const name = raw.trim();
  if (name.length < 2 || name.length > 120) {
    throw new TypeError('Invalid name');
  }
  return name;
};

export interface UserSnapshot {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly passwordHash: string;
  readonly failedLoginAttempts: number;
  readonly lockedUntil: Date | null;
  readonly lastLoginAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type UserUpdateError = 'CANNOT_DISABLE_SELF' | 'CANNOT_DEMOTE_SELF';

export class User {
  private constructor(private state: UserSnapshot) {}

  static register(input: {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    role: Role;
    passwordHash: string;
    now: Date;
  }): User {
    return new User({
      id: input.id,
      organizationId: input.organizationId,
      name: normalizeName(input.name),
      email: normalizeEmail(input.email),
      role: input.role,
      status: 'active',
      passwordHash: input.passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static fromSnapshot(snapshot: UserSnapshot): User {
    return new User({ ...snapshot });
  }

  toSnapshot(): UserSnapshot {
    return { ...this.state };
  }

  get id(): string {
    return this.state.id;
  }

  get organizationId(): string {
    return this.state.organizationId;
  }

  get role(): Role {
    return this.state.role;
  }

  get status(): UserStatus {
    return this.state.status;
  }

  get passwordHash(): string {
    return this.state.passwordHash;
  }

  canAttemptLogin(now: Date): boolean {
    const { status, lockedUntil } = this.state;
    return status === 'active' && (lockedUntil === null || lockedUntil <= now);
  }

  /** Counts a wrong password. Returns whether this failure locked the account. */
  recordFailedLogin(now: Date): { locked: boolean } {
    const lockExpired = this.state.lockedUntil !== null && this.state.lockedUntil <= now;
    const attempts = (lockExpired ? 0 : this.state.failedLoginAttempts) + 1;
    const locked = attempts >= MAX_FAILED_LOGINS;
    this.state = {
      ...this.state,
      failedLoginAttempts: attempts,
      lockedUntil: locked
        ? new Date(now.getTime() + LOCK_DURATION_MS)
        : lockExpired
          ? null
          : this.state.lockedUntil,
      updatedAt: now,
    };
    return { locked };
  }

  recordSuccessfulLogin(now: Date): void {
    this.state = {
      ...this.state,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      updatedAt: now,
    };
  }

  changePassword(passwordHash: string, now: Date): void {
    this.state = {
      ...this.state,
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    };
  }

  /**
   * Admin edits. An actor editing their own account cannot disable or demote
   * themself, so an organization is never left without an admin by mistake.
   */
  update(
    changes: { name?: string; role?: Role; status?: UserStatus },
    actor: { userId: string },
    now: Date,
  ): Result<{ changed: ('name' | 'role' | 'status')[] }, UserUpdateError> {
    const isSelf = actor.userId === this.state.id;
    if (isSelf && changes.status === 'disabled') {
      return err('CANNOT_DISABLE_SELF');
    }
    if (isSelf && changes.role !== undefined && changes.role !== this.state.role) {
      return err('CANNOT_DEMOTE_SELF');
    }

    const next = { ...this.state };
    const changed: ('name' | 'role' | 'status')[] = [];

    if (changes.name !== undefined) {
      const name = normalizeName(changes.name);
      if (name !== next.name) {
        next.name = name;
        changed.push('name');
      }
    }
    if (changes.role !== undefined && changes.role !== next.role) {
      next.role = changes.role;
      changed.push('role');
    }
    if (changes.status !== undefined && changes.status !== next.status) {
      next.status = changes.status;
      changed.push('status');
      if (changes.status === 'active') {
        next.failedLoginAttempts = 0;
        next.lockedUntil = null;
      }
    }

    if (changed.length > 0) {
      this.state = { ...next, updatedAt: now };
    }
    return ok({ changed });
  }
}
