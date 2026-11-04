import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { APP_CONFIG } from '../shared/config/app-config.token.js';
import type { AppConfig } from '../shared/config/app-config.js';
import { READINESS_CHECKS, runReadinessChecks } from './readiness.js';
import type { ReadinessCheck } from './readiness.js';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(READINESS_CHECKS) private readonly checks: readonly ReadinessCheck[],
  ) {}

  /** The process is up. Used by Docker to restart a stuck container. */
  @Get('live')
  live(): { status: 'ok'; version: string } {
    return { status: 'ok', version: this.config.appVersion };
  }

  /** Dependencies are reachable. Used by Traefik/monitoring before sending traffic. */
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ status: 'ok' | 'unavailable'; checks: Readonly<Record<string, 'up' | 'down'>> }> {
    const report = await runReadinessChecks(this.checks);
    void reply.status(report.ready ? 200 : 503);
    return { status: report.ready ? 'ok' : 'unavailable', checks: report.checks };
  }
}
