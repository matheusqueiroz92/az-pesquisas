import type { QuestionnaireDraft } from '@az-pesquisas/contracts';
import {
  bigint,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { organizations } from '../../identity/index.js';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

const organizationId = () =>
  uuid('organization_id')
    .notNull()
    .references(() => organizations.id);

/** Who a survey is made for (spec 013). RLS and checks: drizzle/0005_surveys_security.sql. */
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    name: text('name').notNull(),
    /** CPF or CNPJ, digits only. */
    document: text('document'),
    contactName: text('contact_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    ...timestamps,
  },
  (t) => [
    // Target of the composite FK from surveys: a survey never points to a
    // client of another organization, even if a use case had a bug.
    unique('clients_organization_id_id_unique').on(t.organizationId, t.id),
    index('clients_organization_id_idx').on(t.organizationId),
  ],
);

export const surveys = pgTable(
  'surveys',
  {
    id: uuid('id').primaryKey(),
    organizationId: organizationId(),
    clientId: uuid('client_id'),
    title: text('title').notNull(),
    type: text('type', {
      enum: ['satisfaction', 'market', 'public_opinion', 'municipal_evaluation', 'electoral'],
    }).notNull(),
    status: text('status', { enum: ['draft', 'in_field', 'closed', 'archived'] }).notNull(),
    municipalityCodes: integer('municipality_codes').array().notNull(),
    fieldStart: date('field_start', { mode: 'string' }),
    fieldEnd: date('field_end', { mode: 'string' }),
    targetInterviews: integer('target_interviews'),
    gpsMode: text('gps_mode', { enum: ['off', 'optional', 'required'] }).notNull(),
    audio: text('audio', { enum: ['off', 'on'] }).notNull(),
    minDurationSec: integer('min_duration_sec').notNull(),
    consentText: text('consent_text'),
    tseRegistered: boolean('tse_registered').notNull().default(false),
    tseRegistrationNumber: text('tse_registration_number'),
    tseStatisticianName: text('tse_statistician_name'),
    tseStatisticianConre: text('tse_statistician_conre'),
    tseContractorName: text('tse_contractor_name'),
    tseContractValueCents: bigint('tse_contract_value_cents', { mode: 'number' }),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: 'surveys_client_fk',
      columns: [t.organizationId, t.clientId],
      foreignColumns: [clients.organizationId, clients.id],
    }),
    index('surveys_organization_id_idx').on(t.organizationId),
    index('surveys_client_id_idx').on(t.clientId),
    // Target of composite FKs from tables that belong to a survey (questionnaire_drafts).
    unique('surveys_organization_id_id_unique').on(t.organizationId, t.id),
  ],
);

/**
 * The questionnaire draft of a survey (spec 014): one JSON document saved whole
 * (ADR-0014). Published versions are immutable snapshots (spec 015).
 */
export const questionnaireDrafts = pgTable(
  'questionnaire_drafts',
  {
    surveyId: uuid('survey_id').primaryKey(),
    organizationId: organizationId(),
    content: jsonb('content').$type<QuestionnaireDraft>().notNull(),
    revision: integer('revision').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
    /** Who saved last (a user id; no FK: users are another context). */
    updatedBy: uuid('updated_by'),
  },
  (t) => [
    foreignKey({
      name: 'questionnaire_drafts_survey_fk',
      columns: [t.organizationId, t.surveyId],
      foreignColumns: [surveys.organizationId, surveys.id],
    }).onDelete('cascade'),
  ],
);
