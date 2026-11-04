import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { organizations } from '../../modules/identity/index.js';

/**
 * Events written in the same transaction as the business change, published to
 * the queue afterwards. A crash between commit and publish loses nothing.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Readonly<Record<string, unknown>>>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    index('outbox_events_organization_id_idx').on(table.organizationId),
    index('outbox_events_unpublished_idx')
      .on(table.occurredAt)
      .where(sql`${table.publishedAt} IS NULL`),
  ],
);
