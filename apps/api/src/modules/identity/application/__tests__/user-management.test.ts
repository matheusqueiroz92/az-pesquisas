import { beforeEach, describe, expect, it } from 'vitest';

import { refreshSession } from '../authentication.js';
import { createOrganizationWithAdmin } from '../organization-setup.js';
import { createUser, getUser, listUsers, updateUser } from '../user-management.js';
import { createFakes } from './fakes.js';
import type { Fakes } from './fakes.js';
import { actorFor, addUser, loginAs, setupOrganization, USER_PASSWORD } from './helpers.js';
import type { Actor } from '../ports.js';

let fakes: Fakes;
let adminA: Actor;
let adminB: Actor;

beforeEach(async () => {
  fakes = createFakes();
  adminA = await setupOrganization(fakes, 'a');
  adminB = await setupOrganization(fakes, 'b');
});

const newUser = {
  name: 'Lucas Queiroz',
  email: 'lucas@a.com',
  role: 'coordinator' as const,
  password: USER_PASSWORD,
};

describe('createOrganizationWithAdmin', () => {
  it('creates the organization and its first admin, audited', () => {
    expect(fakes.tables.organizations.size).toBe(2);
    expect(fakes.auditEntries.filter((e) => e.action === 'organization.created')).toHaveLength(2);
  });

  it('refuses an e-mail already used in any organization', async () => {
    expect(
      await createOrganizationWithAdmin(fakes.deps, {
        organizationName: 'Outro',
        slug: 'outro',
        adminName: 'Fulano',
        adminEmail: 'ADMIN@a.com',
        adminPassword: USER_PASSWORD,
      }),
    ).toEqual({ ok: false, error: 'EMAIL_ALREADY_IN_USE' });
  });
});

describe('CA-07: only admins manage users', () => {
  it.each(['coordinator', 'analyst', 'client', 'interviewer'] as const)(
    '%s gets FORBIDDEN on every user operation',
    async (role) => {
      const userId = await addUser(fakes, adminA, role, `${role}@a.com`);
      const actor = actorFor(adminA, userId, role);

      expect(await listUsers(fakes.deps, actor)).toEqual({ ok: false, error: 'FORBIDDEN' });
      expect(await getUser(fakes.deps, actor, adminA.userId)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(await createUser(fakes.deps, actor, newUser)).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
      expect(await updateUser(fakes.deps, actor, adminA.userId, { name: 'X Y' })).toEqual({
        ok: false,
        error: 'FORBIDDEN',
      });
    },
  );
});

describe('createUser', () => {
  it('creates a user in the admin organization, without exposing the password hash', async () => {
    const result = await createUser(fakes.deps, adminA, newUser);

    expect(result.ok && result.value).toEqual({
      id: expect.any(String) as string,
      name: 'Lucas Queiroz',
      email: 'lucas@a.com',
      role: 'coordinator',
      status: 'active',
      lastLoginAt: null,
      createdAt: new Date('2026-11-04T12:00:00Z'),
    });
    expect(JSON.stringify(result)).not.toContain('hashed:');
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      organizationId: adminA.organizationId,
      action: 'user.created',
      actorUserId: adminA.userId,
    });
  });

  it('refuses an e-mail used in another organization', async () => {
    expect(await createUser(fakes.deps, adminA, { ...newUser, email: 'admin@b.com' })).toEqual({
      ok: false,
      error: 'EMAIL_ALREADY_IN_USE',
    });
  });
});

describe('CA-08: organizations never see each other', () => {
  it('lists only users of the admin organization', async () => {
    await addUser(fakes, adminA, 'analyst', 'analista@a.com');
    await addUser(fakes, adminB, 'analyst', 'analista@b.com');

    const listA = await listUsers(fakes.deps, adminA);

    expect(listA.ok && listA.value.map((u) => u.email).sort()).toEqual([
      'admin@a.com',
      'analista@a.com',
    ]);
  });

  it('a user of another organization does not exist for the admin', async () => {
    expect(await getUser(fakes.deps, adminA, adminB.userId)).toEqual({
      ok: false,
      error: 'USER_NOT_FOUND',
    });
    expect(await updateUser(fakes.deps, adminA, adminB.userId, { status: 'disabled' })).toEqual({
      ok: false,
      error: 'USER_NOT_FOUND',
    });
  });
});

describe('updateUser', () => {
  it('disabling a user revokes their sessions and is audited with the changed fields', async () => {
    const userId = await addUser(fakes, adminA, 'analyst', 'analista@a.com');
    const { tokens } = await loginAs(fakes, 'analista@a.com', USER_PASSWORD);

    const result = await updateUser(fakes.deps, adminA, userId, { status: 'disabled' });

    expect(result.ok && result.value.status).toBe('disabled');
    expect((await refreshSession(fakes.deps, { refreshToken: tokens.refreshToken })).ok).toBe(
      false,
    );
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      action: 'user.updated',
      metadata: { changed: ['status'] },
    });
  });

  it('an admin cannot disable or demote themself', async () => {
    expect(await updateUser(fakes.deps, adminA, adminA.userId, { status: 'disabled' })).toEqual({
      ok: false,
      error: 'CANNOT_DISABLE_SELF',
    });
    expect(await updateUser(fakes.deps, adminA, adminA.userId, { role: 'analyst' })).toEqual({
      ok: false,
      error: 'CANNOT_DEMOTE_SELF',
    });
  });

  it('an update that changes nothing is not audited', async () => {
    const before = fakes.auditEntries.length;

    const result = await updateUser(fakes.deps, adminA, adminA.userId, { name: 'Admin a' });

    expect(result.ok).toBe(true);
    expect(fakes.auditEntries).toHaveLength(before);
  });

  it('getUser returns the user details', async () => {
    const userId = await addUser(fakes, adminA, 'client', 'cliente@a.com');

    const result = await getUser(fakes.deps, adminA, userId);

    expect(result.ok && result.value.role).toBe('client');
  });
});
