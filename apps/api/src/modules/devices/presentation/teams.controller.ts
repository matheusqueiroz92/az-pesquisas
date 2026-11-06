import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { Id, UpdateSurveyTeamRequest } from '@az-pesquisas/contracts';
import type { SurveyTeamView } from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, RequirePermission } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import type { DevicesDeps } from '../application/devices-deps.js';
import { getSurveyTeam, updateSurveyTeam } from '../application/teams.js';
import { DEVICES_DEPS } from './devices.tokens.js';
import { httpError } from './http-errors.js';

/** Devices and interviewers of a survey (spec 016 rule 10). */
@Controller('v1/surveys/:id/team')
@RequirePermission('devices.manage')
export class TeamsController {
  constructor(@Inject(DEVICES_DEPS) private readonly deps: DevicesDeps) {}

  @Get()
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
  ): Promise<SurveyTeamView> {
    const result = await getSurveyTeam(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return result.value;
  }

  @Put()
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
    @Body(new ZodValidationPipe(UpdateSurveyTeamRequest)) body: UpdateSurveyTeamRequest,
  ): Promise<SurveyTeamView> {
    const result = await updateSurveyTeam(this.deps, actor, id, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return result.value;
  }
}
