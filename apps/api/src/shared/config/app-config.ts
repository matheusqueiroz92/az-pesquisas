import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';
import { z } from 'zod';

// Empty strings come from lines like `SENTRY_DSN=` in .env files: treat as unset.
const blankAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankAsUndefined, schema);

const envSchema = z
  .object({
    NODE_ENV: optional(z.enum(['development', 'test', 'production']).default('development')),
    APP_ENV: optional(z.enum(['local', 'staging', 'production']).default('local')),
    APP_VERSION: optional(z.string().default('dev')),
    HOST: optional(z.string().default('0.0.0.0')),
    PORT: optional(z.coerce.number().int().min(1).max(65535).default(3000)),
    LOG_LEVEL: optional(
      z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    ),
    CORS_ORIGINS: optional(
      z
        .string()
        .transform((raw) =>
          raw
            .split(',')
            .map((origin) => origin.trim())
            .filter((origin) => origin.length > 0),
        )
        .pipe(z.array(z.url({ protocol: /^https?$/ })))
        .default([]),
    ),
    SENTRY_DSN: optional(z.url().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === 'production' && env.NODE_ENV !== 'production') {
      ctx.addIssue({
        code: 'custom',
        path: ['NODE_ENV'],
        message: 'must be "production" when APP_ENV is "production"',
      });
    }
  });

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly appEnv: 'local' | 'staging' | 'production';
  readonly appVersion: string;
  readonly host: string;
  readonly port: number;
  readonly logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  readonly corsOrigins: readonly string[];
  readonly sentryDsn: string | undefined;
}

export interface ConfigError {
  readonly variables: readonly string[];
  readonly message: string;
}

/**
 * Validates environment variables once, at startup. The error lists variable
 * names only: values may be secrets (a DSN, later a database URL) and must not
 * reach logs or the terminal of whoever reads the crash.
 */
export const loadConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<AppConfig, ConfigError> => {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const variables = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'unknown'))),
    ].sort();
    return err({
      variables,
      message: `Invalid environment variables: ${variables.join(', ')}. Check apps/api/.env.example.`,
    });
  }

  const e = parsed.data;
  return ok({
    nodeEnv: e.NODE_ENV,
    appEnv: e.APP_ENV,
    appVersion: e.APP_VERSION,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    corsOrigins: e.CORS_ORIGINS,
    sentryDsn: e.SENTRY_DSN,
  });
};
