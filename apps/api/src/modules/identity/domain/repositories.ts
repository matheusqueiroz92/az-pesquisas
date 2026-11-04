import type { PasswordReset } from './password-reset.js';
import type { Session } from './session.js';
import type { User } from './user.js';

/**
 * Repository ports. Implementations run inside the current tenant transaction
 * (RLS applies), so none of these methods takes an organizationId.
 */
export interface UserRepository {
  findById(id: string, options?: { forUpdate?: boolean }): Promise<User | undefined>;
  list(): Promise<User[]>;
  add(user: User): Promise<void>;
  save(user: User): Promise<void>;
}

export interface SessionRepository {
  findById(id: string, options?: { forUpdate?: boolean }): Promise<Session | undefined>;
  add(session: Session): Promise<void>;
  save(session: Session): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  /** Revokes every session of the user, optionally keeping one family (the current login). */
  revokeAllForUser(userId: string, now: Date, options?: { exceptFamilyId?: string }): Promise<void>;
}

export interface PasswordResetRepository {
  findById(id: string, options?: { forUpdate?: boolean }): Promise<PasswordReset | undefined>;
  add(reset: PasswordReset): Promise<void>;
  save(reset: PasswordReset): Promise<void>;
}

export interface OrganizationRepository {
  add(organization: { id: string; name: string; slug: string; now: Date }): Promise<void>;
}
