import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The organization (tenant) the current request or job acts for (ADR-0005, barrier 1).
 *
 * It is filled from the credential (user or device token) by the auth layer and
 * read by the database layer to set `app.organization_id` for RLS (barrier 2).
 * Never fill it from request parameters, bodies or headers (AGENTS.md rule 5).
 */
export class MissingTenantContextError extends Error {
  constructor() {
    super('No organization in the current context: wrap the call in runWithTenant()');
    this.name = 'MissingTenantContextError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const storage = new AsyncLocalStorage<{ readonly organizationId: string }>();

export const runWithTenant = <T>(organizationId: string, fn: () => T): T => {
  if (!UUID.test(organizationId)) {
    throw new TypeError('organizationId must be a UUID');
  }
  const current = storage.getStore();
  if (current && current.organizationId !== organizationId) {
    // Switching tenant mid-request would make one organization's data flow into another's.
    throw new Error('TenantContext is already running for another organization');
  }
  return storage.run({ organizationId }, fn);
};

export const findCurrentOrganizationId = (): string | undefined =>
  storage.getStore()?.organizationId;

export const currentOrganizationId = (): string => {
  const organizationId = findCurrentOrganizationId();
  if (organizationId === undefined) {
    throw new MissingTenantContextError();
  }
  return organizationId;
};
