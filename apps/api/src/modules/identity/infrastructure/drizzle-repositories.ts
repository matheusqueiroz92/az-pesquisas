import { and, eq, isNull, ne } from 'drizzle-orm';

import { currentTx } from '../../../shared/database/transaction-context.js';
import { drizzleAuditLog as sharedAuditLog } from '../../../shared/audit/drizzle-audit-log.js';
import type { AuditLog } from '../application/ports.js';
import { PasswordReset } from '../domain/password-reset.js';
import type {
  OrganizationRepository,
  PasswordResetRepository,
  SessionRepository,
  UserRepository,
} from '../domain/repositories.js';
import { Session } from '../domain/session.js';
import { User } from '../domain/user.js';
import { organizations, passwordResets, sessions, users } from './schema.js';

// Every query below runs in the tenant transaction (RLS on): no organization
// filter is needed here for isolation, and none could bypass it.

export const drizzleUserRepository: UserRepository = {
  findById: async (id, options) => {
    const query = currentTx().select().from(users).where(eq(users.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? User.fromSnapshot(row) : undefined;
  },
  list: async () => {
    const rows = await currentTx().select().from(users).orderBy(users.name);
    return rows.map((row) => User.fromSnapshot(row));
  },
  add: async (user) => {
    await currentTx().insert(users).values(user.toSnapshot());
  },
  save: async (user) => {
    const { id, organizationId: _org, createdAt: _created, ...changes } = user.toSnapshot();
    await currentTx().update(users).set(changes).where(eq(users.id, id));
  },
};

export const drizzleSessionRepository: SessionRepository = {
  findById: async (id, options) => {
    const query = currentTx().select().from(sessions).where(eq(sessions.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? Session.fromSnapshot(row) : undefined;
  },
  add: async (session) => {
    await currentTx().insert(sessions).values(session.toSnapshot());
  },
  save: async (session) => {
    const { id, rotatedAt, revokedAt } = session.toSnapshot();
    await currentTx().update(sessions).set({ rotatedAt, revokedAt }).where(eq(sessions.id, id));
  },
  revokeFamily: async (familyId, now) => {
    await currentTx()
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
  },
  revokeAllForUser: async (userId, now, options) => {
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
    if (options?.exceptFamilyId) {
      conditions.push(ne(sessions.familyId, options.exceptFamilyId));
    }
    await currentTx()
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(...conditions));
  },
};

export const drizzlePasswordResetRepository: PasswordResetRepository = {
  findById: async (id, options) => {
    const query = currentTx().select().from(passwordResets).where(eq(passwordResets.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? PasswordReset.fromSnapshot(row) : undefined;
  },
  add: async (reset) => {
    await currentTx().insert(passwordResets).values(reset.toSnapshot());
  },
  save: async (reset) => {
    const { id, usedAt } = reset.toSnapshot();
    await currentTx().update(passwordResets).set({ usedAt }).where(eq(passwordResets.id, id));
  },
};

export const drizzleOrganizationRepository: OrganizationRepository = {
  add: async (org) => {
    await currentTx().insert(organizations).values({
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.now,
      updatedAt: org.now,
    });
  },
};

export const drizzleAuditLog: AuditLog = sharedAuditLog;
