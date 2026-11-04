/**
 * Single source of the permission matrix (Fundação técnica › Segurança).
 * The API guards use it to authorize; the panel uses it to hide what the user cannot do.
 */
export const ROLES = ['admin', 'coordinator', 'analyst', 'client', 'interviewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'users.manage',
  'surveys.manage',
  'surveys.publish',
  'devices.manage',
  'interviews.invalidate',
  'results.view',
  'results.view_own',
  'weighting.manage',
  'microdata.export',
  'fieldwork.audit',
  'interviews.conduct',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const COORDINATION: readonly Permission[] = [
  'surveys.manage',
  'surveys.publish',
  'devices.manage',
  'interviews.invalidate',
  'results.view',
  'weighting.manage',
  'microdata.export',
  'fieldwork.audit',
];

export const ROLE_PERMISSIONS: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  admin: new Set<Permission>(['users.manage', ...COORDINATION]),
  coordinator: new Set<Permission>(COORDINATION),
  analyst: new Set<Permission>(['results.view', 'weighting.manage', 'microdata.export']),
  client: new Set<Permission>(['results.view_own']),
  interviewer: new Set<Permission>(['interviews.conduct']),
};

export const can = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].has(permission);
