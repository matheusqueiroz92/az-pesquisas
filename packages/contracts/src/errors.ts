/**
 * Every `code` the API may return in a Problem Details body (ADR-0008).
 * Stable and in English; the panel and the app translate them to pt-BR.
 */
export const ERROR_CODES = [
  // Generic HTTP
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'METHOD_NOT_ALLOWED',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'UNPROCESSABLE_ENTITY',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'HTTP_ERROR',
  'VALIDATION_FAILED',
  // Identity
  'INVALID_CREDENTIALS',
  'INVALID_REFRESH_TOKEN',
  'INVALID_RESET_TOKEN',
  'INVALID_CURRENT_PASSWORD',
  'EMAIL_ALREADY_IN_USE',
  'USER_NOT_FOUND',
  'CANNOT_DISABLE_SELF',
  'CANNOT_DEMOTE_SELF',
  // Surveys (spec 013)
  'CLIENT_NOT_FOUND',
  'CLIENT_IN_USE',
  'SURVEY_NOT_FOUND',
  'SURVEY_NOT_EDITABLE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
