import { drizzleAuditLog } from '../../../shared/audit/drizzle-audit-log.js';
import type { Database } from '../../../shared/database/database.js';
import { createTransactionRunner } from '../../../shared/database/transaction-context.js';
import { newId } from '../../../shared/ids.js';
import type { SurveysDeps } from '../application/surveys-deps.js';
import {
  drizzleClientRepository,
  drizzleQuestionnaireRepository,
  drizzleQuestionnaireVersionRepository,
  drizzleSurveyRepository,
} from './drizzle-repositories.js';

export const createSurveysDeps = (options: {
  database: Database;
  clock?: SurveysDeps['clock'];
}): SurveysDeps => ({
  clients: drizzleClientRepository,
  surveys: drizzleSurveyRepository,
  questionnaires: drizzleQuestionnaireRepository,
  versions: drizzleQuestionnaireVersionRepository,
  tx: createTransactionRunner(options.database),
  audit: drizzleAuditLog,
  clock: options.clock ?? { now: () => new Date() },
  ids: { next: newId },
});
