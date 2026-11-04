import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { codeForStatus, PROBLEM_CONTENT_TYPE, problemDetails } from './problem-details.js';

interface ResolvedError {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly expected: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Errors raised by Fastify itself (body too large, malformed JSON) carry a 4xx statusCode. */
const fastifyClientError = (error: unknown): { status: number; message: string } | undefined => {
  if (!(error instanceof Error) || !isRecord(error)) {
    return undefined;
  }
  const status = error['statusCode'];
  return typeof status === 'number' && status >= 400 && status < 500
    ? { status, message: error.message }
    : undefined;
};

const resolve = (exception: unknown): ResolvedError => {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const body = exception.getResponse();
    // Domain errors (spec 005) throw HttpException with { code, detail } bodies.
    if (isRecord(body) && typeof body['code'] === 'string') {
      return {
        status,
        code: body['code'],
        detail: typeof body['detail'] === 'string' ? body['detail'] : exception.message,
        expected: status < 500,
      };
    }
    return {
      status,
      code: codeForStatus(status),
      detail: status < 500 ? exception.message : 'Unexpected error',
      expected: status < 500,
    };
  }

  const clientError = fastifyClientError(exception);
  if (clientError) {
    return {
      status: clientError.status,
      code: codeForStatus(clientError.status),
      detail: clientError.message,
      expected: true,
    };
  }

  return { status: 500, code: 'INTERNAL_ERROR', detail: 'Unexpected error', expected: false };
};

/**
 * Single exit point for errors: every failure becomes RFC 9457 Problem Details.
 * Unexpected errors are logged in full and sent to Sentry, but the client only
 * sees a generic message (spec 003, CA-07).
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const error = resolve(exception);

    if (error.expected) {
      request.log.info({ code: error.code, status: error.status }, 'request rejected');
    } else {
      request.log.error({ err: exception, code: error.code }, 'unexpected error');
      Sentry.captureException(exception, { tags: { requestId: request.id } });
    }

    void reply
      .status(error.status)
      .header('content-type', PROBLEM_CONTENT_TYPE)
      .send(
        problemDetails({
          status: error.status,
          code: error.code,
          detail: error.detail,
          instance: request.url.split('?')[0] ?? request.url,
          requestId: request.id,
        }),
      );
  }
}
