import { z } from 'zod';

import { Email, Id, IsoDateTime, NewPassword } from './common.js';
import { ROLES } from './permissions.js';

export const USER_STATUSES = ['active', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const PersonName = z.string().trim().min(2).max(120);

// strictObject: an organizationId (or anything else) sent by the client is refused,
// never silently ignored (AGENTS.md rule 5).
export const CreateUserRequest = z.strictObject({
  name: PersonName,
  email: Email,
  role: z.enum(ROLES),
  password: NewPassword,
});
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const UpdateUserRequest = z
  .strictObject({
    name: PersonName.optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateUserRequest = z.infer<typeof UpdateUserRequest>;

export const UserView = z.object({
  id: Id,
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
  lastLoginAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
});
export type UserView = z.infer<typeof UserView>;

export const UserListResponse = z.object({ items: z.array(UserView) });
export type UserListResponse = z.infer<typeof UserListResponse>;
