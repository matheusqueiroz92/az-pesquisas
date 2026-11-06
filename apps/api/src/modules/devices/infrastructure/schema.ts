import {
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { isNull } from 'drizzle-orm';

import { organizations, users } from '../../identity/index.js';
import { surveys } from '../../surveys/index.js';

const organizationId = () =>
  uuid('organization_id')
    .notNull()
    .references(() => organizations.id);

/** Devices of the organization (spec 016). RLS and checks: migration 0012. */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    nickname: text('nickname').notNull(),
    platform: text('platform', { enum: ['android', 'ios'] }).notNull(),
    model: text('model').notNull(),
    osVersion: text('os_version').notNull(),
    appVersion: text('app_version').notNull(),
    /** SHA-256 of the device token (rule 10). */
    tokenHash: text('token_hash').notNull(),
    pairedAt: timestamp('paired_at', { withTimezone: true }).notNull(),
    pairedBy: uuid('paired_by').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: uuid('revoked_by'),
  },
  (t) => [
    uniqueIndex('devices_token_hash_unique').on(t.tokenHash),
    uniqueIndex('devices_organization_id_id_unique').on(t.organizationId, t.id),
    index('devices_organization_id_idx').on(t.organizationId),
  ],
);

/** One-time pairing codes (spec 016 rule 2). */
export const devicePairings = pgTable(
  'device_pairings',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    /** SHA-256 of the 6-digit code (rule 10). */
    codeHash: text('code_hash').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    deviceId: uuid('device_id'),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (t) => [
    // One PENDING code per digits across all organizations: the app finds the
    // organization from the code alone.
    uniqueIndex('device_pairings_pending_code_unique').on(t.codeHash).where(isNull(t.consumedAt)),
    foreignKey({
      name: 'device_pairings_device_fk',
      columns: [t.organizationId, t.deviceId],
      foreignColumns: [devices.organizationId, devices.id],
    }),
  ],
);

/** Devices that carry each survey (spec 016 rule 10). */
export const surveyDevices = pgTable(
  'survey_devices',
  {
    organizationId: organizationId(),
    surveyId: uuid('survey_id').notNull(),
    deviceId: uuid('device_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull(),
    assignedBy: uuid('assigned_by').notNull(),
  },
  (t) => [
    primaryKey({ name: 'survey_devices_pk', columns: [t.surveyId, t.deviceId] }),
    foreignKey({
      name: 'survey_devices_survey_fk',
      columns: [t.organizationId, t.surveyId],
      foreignColumns: [surveys.organizationId, surveys.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'survey_devices_device_fk',
      columns: [t.organizationId, t.deviceId],
      foreignColumns: [devices.organizationId, devices.id],
    }),
    index('survey_devices_device_id_idx').on(t.deviceId),
  ],
);

/** Interviewers who may apply each survey (spec 016 rule 10). */
export const surveyInterviewers = pgTable(
  'survey_interviewers',
  {
    organizationId: organizationId(),
    surveyId: uuid('survey_id').notNull(),
    userId: uuid('user_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull(),
    assignedBy: uuid('assigned_by').notNull(),
  },
  (t) => [
    primaryKey({ name: 'survey_interviewers_pk', columns: [t.surveyId, t.userId] }),
    foreignKey({
      name: 'survey_interviewers_survey_fk',
      columns: [t.organizationId, t.surveyId],
      foreignColumns: [surveys.organizationId, surveys.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'survey_interviewers_user_fk',
      columns: [t.organizationId, t.userId],
      foreignColumns: [users.organizationId, users.id],
    }),
    index('survey_interviewers_user_id_idx').on(t.userId),
  ],
);
