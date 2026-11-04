import { describe, expect, it } from 'vitest';

import { can, PERMISSIONS, ROLE_PERMISSIONS, ROLES } from './permissions.js';
import type { Permission, Role } from './permissions.js';

// The matrix from Fundação técnica › Segurança › Autorização, written out
// independently so a change in permissions.ts must be made on purpose here too.
const EXPECTED: Readonly<Record<Role, readonly Permission[]>> = {
  admin: [
    'users.manage',
    'surveys.manage',
    'surveys.publish',
    'devices.manage',
    'interviews.invalidate',
    'results.view',
    'weighting.manage',
    'microdata.export',
    'fieldwork.audit',
  ],
  coordinator: [
    'surveys.manage',
    'surveys.publish',
    'devices.manage',
    'interviews.invalidate',
    'results.view',
    'weighting.manage',
    'microdata.export',
    'fieldwork.audit',
  ],
  analyst: ['results.view', 'weighting.manage', 'microdata.export'],
  client: ['results.view_own'],
  interviewer: ['interviews.conduct'],
};

describe('permission matrix', () => {
  it('has the five roles of the planning document', () => {
    expect(ROLES).toEqual(['admin', 'coordinator', 'analyst', 'client', 'interviewer']);
  });

  it.each(ROLES)('grants %s exactly the documented permissions', (role) => {
    expect([...ROLE_PERMISSIONS[role]].sort()).toEqual([...EXPECTED[role]].sort());
  });

  it('can() agrees with the matrix for every role and permission', () => {
    for (const role of ROLES) {
      for (const permission of PERMISSIONS) {
        expect(can(role, permission)).toBe(EXPECTED[role].includes(permission));
      }
    }
  });

  it('only admins manage users', () => {
    expect(ROLES.filter((role) => can(role, 'users.manage'))).toEqual(['admin']);
  });

  it('interviewers only conduct interviews (no panel access to data)', () => {
    expect(PERMISSIONS.filter((p) => can('interviewer', p))).toEqual(['interviews.conduct']);
  });
});
