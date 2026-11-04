import type { Role } from '@az-pesquisas/contracts';

export type { Actor } from '../../../shared/auth/actor.js';
export type { Mailer } from '../../../shared/mail/mailer.js';

export interface Clock {
  now(): Date;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
}

/** Opaque random tokens (refresh, password reset) and their stored hash. */
export interface TokenGenerator {
  generate(): string;
  hash(token: string): string;
}

export interface AccessTokenClaims {
  readonly userId: string;
  readonly organizationId: string;
  readonly role: Role;
  readonly sessionId: string;
}

export interface AccessTokenIssuer {
  issue(claims: AccessTokenClaims, now: Date): Promise<{ token: string; expiresAt: Date }>;
  /** Returns the claims of a valid, unexpired token; undefined otherwise. */
  verify(token: string): Promise<AccessTokenClaims | undefined>;
}

/**
 * The only reads that cross organizations: finding which organization a login
 * e-mail or a token belongs to. Returns ids only (see design 005).
 */
export interface AuthLookup {
  findUserByEmail(email: string): Promise<{ userId: string; organizationId: string } | undefined>;
  findSessionByTokenHash(
    tokenHash: string,
  ): Promise<{ sessionId: string; organizationId: string } | undefined>;
  findPasswordResetByTokenHash(
    tokenHash: string,
  ): Promise<{ resetId: string; organizationId: string } | undefined>;
}

/** Runs work in one database transaction of the current organization (RLS on). */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export type AuditAction =
  | 'organization.created'
  | 'login.succeeded'
  | 'login.failed'
  | 'account.locked'
  | 'session.reuse_detected'
  | 'password.reset_requested'
  | 'password.reset_completed'
  | 'password.changed'
  | 'user.created'
  | 'user.updated';

export interface AuditLog {
  /** Appends to the audit log of the current organization, in the current transaction. */
  record(entry: {
    action: AuditAction;
    actorUserId: string | null;
    entity: 'organization' | 'user' | 'session';
    entityId: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

export interface IdGenerator {
  next(): string;
}
