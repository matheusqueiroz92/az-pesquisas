import { Module } from '@nestjs/common';
import type { DynamicModule, Type } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';

import { HealthController } from './health/health.controller.js';
import { READINESS_CHECKS } from './health/readiness.js';
import type { ReadinessCheck } from './health/readiness.js';
import { APP_CONFIG } from './shared/config/app-config.token.js';
import type { AppConfig } from './shared/config/app-config.js';
import { ProblemDetailsFilter } from './shared/http/problem-details.filter.js';

export interface AppModuleOptions {
  readonly config: AppConfig;
  readonly readinessChecks: readonly ReadinessCheck[];
  /** Extra modules mounted by tests (or, later, feature flags). */
  readonly extraModules?: readonly Type[];
}

@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [...(options.extraModules ?? [])],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: options.config },
        { provide: READINESS_CHECKS, useValue: options.readinessChecks },
        { provide: APP_FILTER, useClass: ProblemDetailsFilter },
      ],
      exports: [APP_CONFIG],
    };
  }
}
