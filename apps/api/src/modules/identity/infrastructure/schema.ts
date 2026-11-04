import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * A research institute using the system (the tenant). RLS lets a session see
 * only its own row: see drizzle/0001_tenant_isolation.sql.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ...timestamps,
});

const organizationId = () =>
  uuid('organization_id')
    .notNull()
    .references(() => organizations.id);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    name: text('name').notNull(),
    // Stored lower-cased; unique across ALL organizations (it is the login key).
    email: text('email').notNull(),
    role: text('role', {
      enum: ['admin', 'coordinator', 'analyst', 'client', 'interviewer'],
    }).notNull(),
    status: text('status', { enum: ['active', 'disabled'] }).notNull(),
    passwordHash: text('password_hash').notNull(),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    index('users_organization_id_idx').on(t.organizationId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_unique').on(t.tokenHash),
    index('sessions_organization_id_idx').on(t.organizationId),
    index('sessions_user_id_idx').on(t.userId),
    index('sessions_family_id_idx').on(t.familyId),
  ],
);

export const passwordResets = pgTable(
  'password_resets',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('password_resets_token_hash_unique').on(t.tokenHash),
    index('password_resets_organization_id_idx').on(t.organizationId),
    index('password_resets_user_id_idx').on(t.userId),
  ],
);

/** Append-only: az_app has no UPDATE/DELETE on this table (migration 0003). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    actorUserId: uuid('actor_user_id'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    metadata: jsonb('metadata')
      .$type<Readonly<Record<string, unknown>>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_organization_created_idx').on(t.organizationId, t.createdAt)],
);
