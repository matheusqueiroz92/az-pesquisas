import { z } from 'zod';

import { Email, Id, IsoDateTime, NewPassword, OpaqueToken } from './common.js';
import { ROLES } from './permissions.js';

export const LoginRequest = z.strictObject({
  email: Email,
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const RefreshRequest = z.strictObject({ refreshToken: OpaqueToken });
export type RefreshRequest = z.infer<typeof RefreshRequest>;

export const LogoutRequest = RefreshRequest;
export type LogoutRequest = RefreshRequest;

export const MeResponse = z.object({
  id: Id,
  organizationId: Id,
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLES),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const TokenResponse = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: IsoDateTime,
  refreshToken: z.string(),
  refreshTokenExpiresAt: IsoDateTime,
  user: MeResponse,
});
export type TokenResponse = z.infer<typeof TokenResponse>;

export const PasswordResetRequest = z.strictObject({ email: Email });
export type PasswordResetRequest = z.infer<typeof PasswordResetRequest>;

export const PasswordResetConfirm = z.strictObject({
  token: OpaqueToken,
  newPassword: NewPassword,
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirm>;

export const ChangePasswordRequest = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: NewPassword,
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;
