import { can } from '@az-pesquisas/contracts';
import type { Permission } from '@az-pesquisas/contracts';
import { err } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { runWithTenant } from '../../../shared/tenancy/tenant-context.js';
import type { Actor } from './ports.js';
import type { SurveysDeps } from './surveys-deps.js';

/**
 * Runs the work as the actor's organization, in one transaction, if the role
 * has the permission. Authorization lives in the use case too, not only in the
 * HTTP guard (spec 013 rule 1).
 */
export const withPermission = <T, E>(
  deps: SurveysDeps,
  actor: Actor,
  permission: Permission,
  work: () => Promise<Result<T, E>>,
): Promise<Result<T, E | 'FORBIDDEN'>> => {
  if (!can(actor.role, permission)) {
    return Promise.resolve(err('FORBIDDEN'));
  }
  return runWithTenant(actor.organizationId, () => deps.tx.run(work));
};

/** `surveys.manage`: what coordination does to clients, surveys and questionnaires. */
export const asManager = <T, E>(
  deps: SurveysDeps,
  actor: Actor,
  work: () => Promise<Result<T, E>>,
): Promise<Result<T, E | 'FORBIDDEN'>> => withPermission(deps, actor, 'surveys.manage', work);
