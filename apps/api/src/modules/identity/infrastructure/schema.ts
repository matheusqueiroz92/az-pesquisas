import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * A research institute using the system (the tenant). RLS lets a session see
 * only its own row: see drizzle/0001_tenant_isolation.sql.
 */
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
