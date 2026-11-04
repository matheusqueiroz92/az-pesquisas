import 'reflect-metadata';

import type { IncomingMessage } from 'node:http';

import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { LogController } from 'fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Type } from '@nestjs/common';
import type { DestinationStream } from 'pino';

import { AppModule } from './app.module.js';
import type { ReadinessCheck } from './health/readiness.js';
import type { AppConfig } from './shared/config/app-config.js';
import { createDatabase } from './shared/database/database.js';
import type { Database } from './shared/database/database.js';
import { REQUEST_ID_HEADER, resolveRequestId } from './shared/http/request-id.js';
import { createLogger, PinoNestLogger } from './shared/logging/logger.js';

/** Largest accepted body: one sync batch (Fundação técnica › Segurança). */
export const BODY_LIMIT_BYTES = 2 * 1024 * 1024;

export interface CreateAppOptions {
  /** Defaults to a pool built from config.databaseUrl (connects lazily). */
  readonly database?: Database;
  /** Defaults to [database]. */
  readonly readinessChecks?: readonly ReadinessCheck[];
  /** Where logs go; defaults to stdout. Tests pass a stream to inspect them. */
  readonly logDestination?: DestinationStream;
  readonly extraModules?: readonly Type[];
}

/** Builds a fully configured app without listening, so tests can use fastify.inject(). */
export const createApp = async (
  config: AppConfig,
  options: CreateAppOptions = {},
): Promise<NestFastifyApplication> => {
  const logger = createLogger(config, options.logDestination);
  const database =
    options.database ??
    createDatabase({ url: config.databaseUrl, poolMax: config.databasePoolMax });
  const readinessChecks = options.readinessChecks ?? [
    { name: 'database', check: () => database.ping() },
  ];

  const adapter = new FastifyAdapter({
    loggerInstance: logger,
    // Behind Traefik: trust X-Forwarded-* for the client IP and protocol.
    trustProxy: true,
    bodyLimit: BODY_LIMIT_BYTES,
    requestIdHeader: false,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    genReqId: (req: IncomingMessage) => resolveRequestId(req.headers[REQUEST_ID_HEADER]),
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot({
      config,
      database,
      readinessChecks,
      extraModules: options.extraModules ?? [],
    }),
    adapter,
    { logger: new PinoNestLogger(logger), bufferLogs: false },
  );

  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', (request, reply, payload, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done(null, payload);
  });

  await app.register(helmet, {
    // The API serves JSON only; the panel sets its own CSP (spec 007).
    contentSecurityPolicy: false,
  });

  app.enableCors({
    origin: config.corsOrigins.length > 0 ? [...config.corsOrigins] : false,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });

  app.enableShutdownHooks();
  await app.init();
  await fastify.ready();
  return app;
};
