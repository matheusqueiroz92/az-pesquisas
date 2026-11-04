/** RFC 9457 body returned by every error response (ADR-0008). */
export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance: string;
  /** Stable, English, machine-readable; the app and the panel translate it to pt-BR. */
  readonly code: string;
  readonly requestId: string;
  /** Present on VALIDATION_FAILED: which fields failed, never their values. */
  readonly errors?: readonly { readonly field: string; readonly code: string }[];
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json; charset=utf-8';

const CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

const TITLES: Readonly<Record<number, string>> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Content Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
};

export const codeForStatus = (status: number): string =>
  CODES[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'HTTP_ERROR');

export const problemDetails = (input: {
  status: number;
  code: string;
  detail: string;
  instance: string;
  requestId: string;
  errors?: ProblemDetails['errors'];
}): ProblemDetails => ({
  type: `urn:az-pesquisas:error:${input.code}`,
  title: TITLES[input.status] ?? 'Error',
  status: input.status,
  detail: input.detail,
  instance: input.instance,
  code: input.code,
  requestId: input.requestId,
  ...(input.errors ? { errors: input.errors } : {}),
});
