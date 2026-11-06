import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@az-pesquisas/contracts';

/** Use-case error codes of the surveys context and their HTTP status. */
const STATUS: Partial<Record<ErrorCode, number>> = {
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CLIENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  CLIENT_IN_USE: HttpStatus.CONFLICT,
  SURVEY_NOT_FOUND: HttpStatus.NOT_FOUND,
  SURVEY_NOT_EDITABLE: HttpStatus.CONFLICT,
};

const DETAIL: Partial<Record<ErrorCode, string>> = {
  FORBIDDEN: 'You do not have permission for this action',
  CLIENT_NOT_FOUND: 'Client not found',
  CLIENT_IN_USE: 'The client has surveys and cannot be deleted',
  SURVEY_NOT_FOUND: 'Survey not found',
  SURVEY_NOT_EDITABLE: 'The survey cannot be changed in its current status',
};

/** Turns a use-case error into the HttpException the ProblemDetailsFilter understands. */
export const httpError = (code: ErrorCode): HttpException =>
  new HttpException(
    { code, detail: DETAIL[code] ?? code },
    STATUS[code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
  );
