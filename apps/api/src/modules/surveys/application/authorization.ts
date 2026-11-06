import { can } from '@az-pesquisas/contracts';
import { err } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { runWithTenant } from '../../../shared/tenancy/tenant-context.js';
import type { Actor } from './ports.js';
import type { SurveysDeps } from './surveys-deps.js';

// Authorization lives in the use case too, not only in the HTTP guard (spec 013 rule 1).
const canManage = (actor: Actor): boolean => can(actor.role, 'surveys.manage');

/** Runs the work as the actor's organization, in one transaction, if allowed. */
export const asManager = <T, E>(
  deps: SurveysDeps,
  actor: Actor,
  work: () => Promise<Result<T, E>>,
): Promise<Result<T, E | 'FORBIDDEN'>> => {
  if (!canManage(actor)) {
    return Promise.resolve(err('FORBIDDEN'));
  }
  return runWithTenant(actor.organizationId, () => deps.tx.run(work));
};
