import { describe, expect, it } from 'vitest';

import { codeForStatus, problemDetails } from './problem-details.js';

describe('codeForStatus', () => {
  it.each([
    [400, 'BAD_REQUEST'],
    [401, 'UNAUTHENTICATED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [405, 'METHOD_NOT_ALLOWED'],
    [409, 'CONFLICT'],
    [413, 'PAYLOAD_TOO_LARGE'],
    [415, 'UNSUPPORTED_MEDIA_TYPE'],
    [422, 'UNPROCESSABLE_ENTITY'],
    [429, 'RATE_LIMITED'],
    [500, 'INTERNAL_ERROR'],
    [503, 'SERVICE_UNAVAILABLE'],
  ])('maps %i to %s', (status, code) => {
    expect(codeForStatus(status)).toBe(code);
  });

  it('falls back to a generic code for unmapped statuses', () => {
    expect(codeForStatus(418)).toBe('HTTP_ERROR');
    expect(codeForStatus(502)).toBe('INTERNAL_ERROR');
  });
});

describe('problemDetails', () => {
  it('builds an RFC 9457 body with the stable code and request id', () => {
    expect(
      problemDetails({
        status: 404,
        code: 'NOT_FOUND',
        detail: 'Route GET /x not found',
        instance: '/x',
        requestId: 'req-12345678',
      }),
    ).toEqual({
      type: 'urn:az-pesquisas:error:NOT_FOUND',
      title: 'Not Found',
      status: 404,
      detail: 'Route GET /x not found',
      instance: '/x',
      code: 'NOT_FOUND',
      requestId: 'req-12345678',
    });
  });

  it('uses a generic title for unknown statuses', () => {
    expect(
      problemDetails({
        status: 499,
        code: 'HTTP_ERROR',
        detail: 'x',
        instance: '/',
        requestId: 'r',
      }).title,
    ).toBe('Error');
  });
});
