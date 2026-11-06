import { and, count, desc, eq, isNotNull } from 'drizzle-orm';

import { currentTx } from '../../../shared/database/transaction-context.js';
import { Client } from '../domain/client.js';
import type { QuestionnaireVersion } from '../domain/publication.js';
import { Questionnaire } from '../domain/questionnaire.js';
import type {
  ClientRepository,
  QuestionnaireRepository,
  QuestionnaireVersionRepository,
  SurveyRepository,
} from '../domain/repositories.js';
import { Survey } from '../domain/survey.js';
import type { SurveySnapshot } from '../domain/survey.js';
import { clients, questionnaireDrafts, questionnaireVersions, surveys } from './schema.js';

// Every query below runs in the tenant transaction (RLS on): no organization
// filter is needed here for isolation, and none could bypass it.

type SurveyRow = typeof surveys.$inferSelect;
type SurveyInsert = typeof surveys.$inferInsert;

const toSurveySnapshot = (row: SurveyRow): SurveySnapshot => ({
  id: row.id,
  organizationId: row.organizationId,
  clientId: row.clientId,
  title: row.title,
  type: row.type,
  status: row.status,
  publishedVersion: row.publishedVersion,
  municipalityCodes: row.municipalityCodes,
  fieldStart: row.fieldStart,
  fieldEnd: row.fieldEnd,
  targetInterviews: row.targetInterviews,
  settings: {
    gps: row.gpsMode,
    audio: row.audio,
    minDurationSec: row.minDurationSec,
    consentText: row.consentText,
  },
  tse: row.tseRegistered
    ? {
        registrationNumber: row.tseRegistrationNumber,
        statisticianName: row.tseStatisticianName,
        statisticianConre: row.tseStatisticianConre,
        contractorName: row.tseContractorName,
        contractValueCents: row.tseContractValueCents,
      }
    : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toSurveyRow = (s: SurveySnapshot): SurveyInsert => ({
  id: s.id,
  organizationId: s.organizationId,
  clientId: s.clientId,
  title: s.title,
  type: s.type,
  status: s.status,
  publishedVersion: s.publishedVersion,
  municipalityCodes: [...s.municipalityCodes],
  fieldStart: s.fieldStart,
  fieldEnd: s.fieldEnd,
  targetInterviews: s.targetInterviews,
  gpsMode: s.settings.gps,
  audio: s.settings.audio,
  minDurationSec: s.settings.minDurationSec,
  consentText: s.settings.consentText,
  tseRegistered: s.tse !== null,
  tseRegistrationNumber: s.tse?.registrationNumber ?? null,
  tseStatisticianName: s.tse?.statisticianName ?? null,
  tseStatisticianConre: s.tse?.statisticianConre ?? null,
  tseContractorName: s.tse?.contractorName ?? null,
  tseContractValueCents: s.tse?.contractValueCents ?? null,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
});

export const drizzleClientRepository: ClientRepository = {
  findById: async (id, options) => {
    const query = currentTx().select().from(clients).where(eq(clients.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? Client.fromSnapshot(row) : undefined;
  },
  list: async () => {
    const rows = await currentTx().select().from(clients);
    return rows
      .map((row) => Client.fromSnapshot(row))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },
  add: async (client) => {
    await currentTx().insert(clients).values(client.toSnapshot());
  },
  save: async (client) => {
    const { id, organizationId: _org, createdAt: _created, ...changes } = client.toSnapshot();
    await currentTx().update(clients).set(changes).where(eq(clients.id, id));
  },
  remove: async (id) => {
    await currentTx().delete(clients).where(eq(clients.id, id));
  },
};

export const drizzleSurveyRepository: SurveyRepository = {
  findById: async (id, options) => {
    const query = currentTx().select().from(surveys).where(eq(surveys.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? Survey.fromSnapshot(toSurveySnapshot(row)) : undefined;
  },
  list: async () => {
    const rows = await currentTx().select().from(surveys);
    return rows.map((row) => Survey.fromSnapshot(toSurveySnapshot(row)));
  },
  add: async (survey) => {
    await currentTx().insert(surveys).values(toSurveyRow(survey.toSnapshot()));
  },
  save: async (survey) => {
    const {
      id,
      organizationId: _org,
      createdAt: _created,
      ...changes
    } = toSurveyRow(survey.toSnapshot());
    await currentTx().update(surveys).set(changes).where(eq(surveys.id, id));
  },
  remove: async (id) => {
    await currentTx().delete(surveys).where(eq(surveys.id, id));
  },
  countByClient: async () => {
    const rows = await currentTx()
      .select({ clientId: surveys.clientId, total: count() })
      .from(surveys)
      .where(isNotNull(surveys.clientId))
      .groupBy(surveys.clientId);
    return new Map(rows.flatMap((row) => (row.clientId ? [[row.clientId, row.total]] : [])));
  },
};

export const drizzleQuestionnaireRepository: QuestionnaireRepository = {
  find: async (surveyId) => {
    const [row] = await currentTx()
      .select()
      .from(questionnaireDrafts)
      .where(eq(questionnaireDrafts.surveyId, surveyId));
    return row ? Questionnaire.fromSnapshot(row) : undefined;
  },
  save: async (questionnaire) => {
    const row = questionnaire.toSnapshot();
    const values = { ...row, updatedAt: row.updatedAt ?? new Date() };
    await currentTx()
      .insert(questionnaireDrafts)
      .values(values)
      .onConflictDoUpdate({
        target: questionnaireDrafts.surveyId,
        set: {
          content: values.content,
          revision: values.revision,
          updatedAt: values.updatedAt,
          updatedBy: values.updatedBy,
        },
      });
  },
};

const versionsOf = (surveyId: string) =>
  currentTx()
    .select()
    .from(questionnaireVersions)
    .where(eq(questionnaireVersions.surveyId, surveyId))
    .orderBy(desc(questionnaireVersions.number));

export const drizzleQuestionnaireVersionRepository: QuestionnaireVersionRepository = {
  latest: async (surveyId): Promise<QuestionnaireVersion | undefined> => {
    const [row] = await versionsOf(surveyId).limit(1);
    return row;
  },
  list: async (surveyId) => versionsOf(surveyId),
  findByNumber: async (surveyId, number) => {
    const [row] = await currentTx()
      .select()
      .from(questionnaireVersions)
      .where(
        and(eq(questionnaireVersions.surveyId, surveyId), eq(questionnaireVersions.number, number)),
      );
    return row;
  },
  add: async (version) => {
    await currentTx()
      .insert(questionnaireVersions)
      .values({ ...version, changes: [...version.changes] });
  },
};
