import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@az-pesquisas/contracts';

/** Use-case error codes of the surveys context and their HTTP status. */
const STATUS: Partial<Record<ErrorCode, number>> = {
  FORBIDDEN: HttpStatus.FORBIDDEN,
  CLIENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  CLIENT_IN_USE: HttpStatus.CONFLICT,
  SURVEY_NOT_FOUND: HttpStatus.NOT_FOUND,
  SURVEY_NOT_EDITABLE: HttpStatus.CONFLICT,
  QUESTIONNAIRE_CONFLICT: HttpStatus.CONFLICT,
  QUESTIONNAIRE_LOCKED: HttpStatus.CONFLICT,
  QUESTIONNAIRE_NOT_PUBLISHABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  QUESTIONNAIRE_UNCHANGED: HttpStatus.CONFLICT,
  QUESTIONNAIRE_INCOMPATIBLE: HttpStatus.UNPROCESSABLE_ENTITY,
  QUESTIONNAIRE_VERSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  SURVEY_TSE_INCOMPLETE: HttpStatus.UNPROCESSABLE_ENTITY,
  SURVEY_FIELD_LOCKED: HttpStatus.CONFLICT,
};

const DETAIL: Partial<Record<ErrorCode, string>> = {
  FORBIDDEN: 'You do not have permission for this action',
  CLIENT_NOT_FOUND: 'Client not found',
  CLIENT_IN_USE: 'The client has surveys and cannot be deleted',
  SURVEY_NOT_FOUND: 'Survey not found',
  SURVEY_NOT_EDITABLE: 'The survey cannot be changed in its current status',
  QUESTIONNAIRE_CONFLICT: 'The questionnaire was saved by someone else; reload it',
  QUESTIONNAIRE_LOCKED: 'The questionnaire of this survey cannot be edited',
  QUESTIONNAIRE_NOT_PUBLISHABLE: 'The questionnaire has pending issues',
  QUESTIONNAIRE_UNCHANGED: 'Nothing changed since the last published version',
  QUESTIONNAIRE_INCOMPATIBLE: 'A question changed its type since the last version',
  QUESTIONNAIRE_VERSION_NOT_FOUND: 'Version not found',
  SURVEY_TSE_INCOMPLETE: 'The TSE data of the survey is incomplete',
  SURVEY_FIELD_LOCKED: 'This field cannot change after the first publication',
};

/** Turns a use-case error into the HttpException the ProblemDetailsFilter understands. */
export const httpError = (code: ErrorCode): HttpException =>
  new HttpException(
    { code, detail: DETAIL[code] ?? code },
    STATUS[code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
  );
