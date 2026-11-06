import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { organizations } from '../../modules/identity/index.js';

/**
 * Append-only log of who did what, written in the same transaction as the
 * change (spec 005 rule 18). Shared by every context; each one declares the
 * actions it records in its own application/ports.ts.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
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
