import { Module } from '@nestjs/common';
import type { DynamicModule, Type } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { HealthController } from './health/health.controller.js';
import { READINESS_CHECKS } from './health/readiness.js';
import type { ReadinessCheck } from './health/readiness.js';
import { IdentityModule } from './modules/identity/presentation/index.js';
import { AuthGuard } from './shared/auth/auth.guard.js';
import { TenantInterceptor } from './shared/auth/tenant.interceptor.js';
import { APP_CONFIG } from './shared/config/app-config.token.js';
import type { AppConfig } from './shared/config/app-config.js';
import { DatabaseLifecycle } from './shared/database/database-lifecycle.js';
import type { Database } from './shared/database/database.js';
import { DATABASE } from './shared/database/database.token.js';
import { ProblemDetailsFilter } from './shared/http/problem-details.filter.js';
import { MAILER } from './shared/mail/mailer.js';
import type { Mailer } from './shared/mail/mailer.js';

export interface AppModuleOptions {
  readonly config: AppConfig;
  readonly database: Database;
  readonly mailer: Mailer;
  readonly readinessChecks: readonly ReadinessCheck[];
  /** Extra modules mounted by tests (or, later, feature flags). */
  readonly extraModules?: readonly Type[];
}

/** Baseline per IP and minute; login and password reset have stricter limits. */
const DEFAULT_RATE_LIMIT = { ttl: 60_000, limit: 300 };

@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        ThrottlerModule.forRoot([DEFAULT_RATE_LIMIT]),
        IdentityModule,
        ...(options.extraModules ?? []),
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: options.config },
        { provide: DATABASE, useValue: options.database },
        { provide: MAILER, useValue: options.mailer },
        DatabaseLifecycle,
        { provide: READINESS_CHECKS, useValue: options.readinessChecks },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
        // Order matters: rate limit before authentication, so brute force is cheap to reject.
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
      ],
      exports: [APP_CONFIG, DATABASE, MAILER],
    };
  }
}
