import { inArray } from 'drizzle-orm';
import type { SurveyStatus } from '@az-pesquisas/contracts';

import { currentTx } from '../../../shared/database/transaction-context.js';
import { surveys } from './schema.js';

export interface SurveyRef {
  readonly id: string;
  readonly title: string;
  readonly status: SurveyStatus;
}

/**
 * What other contexts may read about surveys (AGENTS.md rule 4). Runs in the
 * caller's tenant transaction, so RLS applies.
 */
export const surveyDirectory = {
  find: async (ids: readonly string[]): Promise<SurveyRef[]> =>
    ids.length === 0
      ? []
      : currentTx()
          .select({ id: surveys.id, title: surveys.title, status: surveys.status })
          .from(surveys)
          .where(inArray(surveys.id, [...ids])),
};
