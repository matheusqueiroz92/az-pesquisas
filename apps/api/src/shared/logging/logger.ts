import type { LoggerService } from '@nestjs/common';
import { pino } from 'pino';
import type { DestinationStream, Logger } from 'pino';

import type { AppConfig } from '../config/app-config.js';

/**
 * Paths replaced by [REDACTED] in every log line (AGENTS.md rule 10).
 * `*.field` matches the field one level deep; request/response headers are covered explicitly.
 */
export const REDACTED_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-device-token"]',
  'res.headers["set-cookie"]',
  ...[
    'password',
    'pin',
    'token',
    'refreshToken',
    'accessToken',
    'deviceToken',
    'answers',
    'location',
    'lat',
    'lng',
  ].flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
];

export const createLogger = (config: AppConfig, destination?: DestinationStream): Logger =>
  pino(
    {
      level: config.logLevel,
      base: { app: 'az-pesquisas-api', env: config.appEnv, version: config.appVersion },
      redact: { paths: [...REDACTED_PATHS], censor: '[REDACTED]' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination,
  );

/** Routes NestJS framework logs (bootstrap, module init) to the same pino instance. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }

  error(message: unknown, stackOrContext?: string, context?: string): void {
    this.logger.error({ context: context ?? stackOrContext }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }

  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message));
  }
}
