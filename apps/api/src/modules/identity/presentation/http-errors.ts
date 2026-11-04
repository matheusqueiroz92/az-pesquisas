import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@az-pesquisas/contracts';

/** Domain/application error codes of the identity context and their HTTP status. */
const STATUS: Partial<Record<ErrorCode, number>> = {
  INVALID_CREDENTIALS: HttpStatus.UNAUTHORIZED,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  INVALID_RESET_TOKEN: HttpStatus.BAD_REQUEST,
  INVALID_CURRENT_PASSWORD: HttpStatus.BAD_REQUEST,
  EMAIL_ALREADY_IN_USE: HttpStatus.CONFLICT,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  CANNOT_DISABLE_SELF: HttpStatus.CONFLICT,
  CANNOT_DEMOTE_SELF: HttpStatus.CONFLICT,
  FORBIDDEN: HttpStatus.FORBIDDEN,
};

const DETAIL: Partial<Record<ErrorCode, string>> = {
  INVALID_CREDENTIALS: 'E-mail or password is incorrect',
  INVALID_REFRESH_TOKEN: 'The session is no longer valid; log in again',
  INVALID_RESET_TOKEN: 'The password reset link is invalid or has expired',
  INVALID_CURRENT_PASSWORD: 'The current password is incorrect',
  EMAIL_ALREADY_IN_USE: 'This e-mail is already in use',
  USER_NOT_FOUND: 'User not found',
  CANNOT_DISABLE_SELF: 'You cannot disable your own account',
  CANNOT_DEMOTE_SELF: 'You cannot change your own role',
  FORBIDDEN: 'You do not have permission for this action',
};

/** Turns a use-case error into the HttpException the ProblemDetailsFilter understands. */
export const httpError = (code: ErrorCode): HttpException =>
  new HttpException(
    { code, detail: DETAIL[code] ?? code },
    STATUS[code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
  );
