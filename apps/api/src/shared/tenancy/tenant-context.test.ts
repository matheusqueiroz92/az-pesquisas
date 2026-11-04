import { describe, expect, it } from 'vitest';

import {
  currentOrganizationId,
  findCurrentOrganizationId,
  MissingTenantContextError,
  runWithTenant,
} from './tenant-context.js';

const ORG_A = '0193a000-0000-7000-8000-00000000000a';
const ORG_B = '0193b000-0000-7000-8000-00000000000b';

describe('TenantContext', () => {
  it('exposes the organization inside runWithTenant', () => {
    const seen = runWithTenant(ORG_A, () => currentOrganizationId());

    expect(seen).toBe(ORG_A);
  });

  it('keeps the organization across awaits', async () => {
    const seen = await runWithTenant(ORG_A, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return currentOrganizationId();
    });

    expect(seen).toBe(ORG_A);
  });

  it('isolates concurrent requests from different organizations', async () => {
    const read = (org: string, delay: number) =>
      runWithTenant(org, async () => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return currentOrganizationId();
      });

    const [a, b] = await Promise.all([read(ORG_A, 15), read(ORG_B, 1)]);

    expect([a, b]).toEqual([ORG_A, ORG_B]);
  });

  it('CA-06: throws MissingTenantContextError outside a tenant scope', () => {
    expect(() => currentOrganizationId()).toThrow(MissingTenantContextError);
  });

  it('does not leak the organization after the scope ends', () => {
    runWithTenant(ORG_A, () => undefined);

    expect(findCurrentOrganizationId()).toBeUndefined();
  });

  it('rejects a value that is not a UUID (it would reach a SQL setting)', () => {
    expect(() => {
      runWithTenant('not-a-uuid', () => undefined);
    }).toThrow('organizationId must be a UUID');
    expect(() => {
      runWithTenant("x'; drop table organizations; --", () => undefined);
    }).toThrow();
  });

  it('does not allow switching organization inside a scope', () => {
    expect(() =>
      runWithTenant(ORG_A, () => runWithTenant(ORG_B, () => currentOrganizationId())),
    ).toThrow('already running for another organization');
  });

  it('allows re-entering with the same organization', () => {
    expect(runWithTenant(ORG_A, () => runWithTenant(ORG_A, () => currentOrganizationId()))).toBe(
      ORG_A,
    );
  });
});
