import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@az-pesquisas/contracts';

const STATUS: Partial<Record<ErrorCode, number>> = {
  FORBIDDEN: HttpStatus.FORBIDDEN,
  SURVEY_NOT_FOUND: HttpStatus.NOT_FOUND,
  SURVEY_NOT_ASSIGNABLE: HttpStatus.CONFLICT,
  DEVICE_NOT_FOUND: HttpStatus.NOT_FOUND,
  DEVICE_REVOKED: HttpStatus.CONFLICT,
  PAIRING_NOT_FOUND: HttpStatus.NOT_FOUND,
  PAIRING_CODE_INVALID: HttpStatus.UNPROCESSABLE_ENTITY,
  DEVICE_TOKEN_INVALID: HttpStatus.UNAUTHORIZED,
  INTERVIEWER_NOT_FOUND: HttpStatus.UNPROCESSABLE_ENTITY,
};

const DETAIL: Partial<Record<ErrorCode, string>> = {
  FORBIDDEN: 'You do not have permission for this action',
  SURVEY_NOT_FOUND: 'Survey not found',
  SURVEY_NOT_ASSIGNABLE: 'Closed or archived surveys get no new team',
  DEVICE_NOT_FOUND: 'Device not found',
  DEVICE_REVOKED: 'The device was revoked',
  PAIRING_NOT_FOUND: 'Pairing not found',
  PAIRING_CODE_INVALID: 'Invalid or expired code',
  DEVICE_TOKEN_INVALID: 'Unknown or revoked device',
  INTERVIEWER_NOT_FOUND: 'Not an active interviewer of this organization',
};

export const httpError = (code: ErrorCode): HttpException =>
  new HttpException(
    { code, detail: DETAIL[code] ?? code },
    STATUS[code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
  );
