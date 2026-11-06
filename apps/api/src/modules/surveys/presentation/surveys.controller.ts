import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateSurveyRequest, Id, UpdateSurveyRequest } from '@az-pesquisas/contracts';
import type { SurveyListResponse, SurveyView } from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, RequirePermission } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import type { SurveysDeps } from '../application/surveys-deps.js';
import {
  archiveSurvey,
  createSurvey,
  deleteSurvey,
  duplicateSurvey,
  getSurvey,
  listSurveys,
  unarchiveSurvey,
  updateSurvey,
} from '../application/surveys.js';
import type { SurveyDetails } from '../application/views.js';
import { httpError } from './http-errors.js';
import { SURVEYS_DEPS } from './surveys.tokens.js';
import { toSurveySummary, toSurveyView } from './views.js';

type Outcome =
  { ok: true; value: SurveyDetails } | { ok: false; error: Parameters<typeof httpError>[0] };

const viewOf = (result: Outcome): SurveyView => {
  if (!result.ok) {
    throw httpError(result.error);
  }
  return toSurveyView(result.value);
};

const IdParam = new ZodValidationPipe(Id);

@Controller('v1/surveys')
@RequirePermission('surveys.manage')
export class SurveysController {
  constructor(@Inject(SURVEYS_DEPS) private readonly deps: SurveysDeps) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<SurveyListResponse> {
    const result = await listSurveys(this.deps, actor);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return { items: result.value.map(toSurveySummary) };
  }

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateSurveyRequest)) body: CreateSurveyRequest,
  ): Promise<SurveyView> {
    return viewOf(await createSurvey(this.deps, actor, body));
  }

  @Get(':id')
  async get(@CurrentActor() actor: Actor, @Param('id', IdParam) id: string): Promise<SurveyView> {
    return viewOf(await getSurvey(this.deps, actor, id));
  }

  @Patch(':id')
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
    @Body(new ZodValidationPipe(UpdateSurveyRequest)) body: UpdateSurveyRequest,
  ): Promise<SurveyView> {
    return viewOf(await updateSurvey(this.deps, actor, id, body));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentActor() actor: Actor, @Param('id', IdParam) id: string): Promise<void> {
    const result = await deleteSurvey(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
  ): Promise<SurveyView> {
    return viewOf(await archiveSurvey(this.deps, actor, id));
  }

  @Post(':id/unarchive')
  @HttpCode(HttpStatus.OK)
  async unarchive(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
  ): Promise<SurveyView> {
    return viewOf(await unarchiveSurvey(this.deps, actor, id));
  }

  @Post(':id/duplicate')
  async duplicate(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
  ): Promise<SurveyView> {
    return viewOf(await duplicateSurvey(this.deps, actor, id));
  }
}
