import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Id, PublishQuestionnaireRequest } from '@az-pesquisas/contracts';
import type {
  PublicationPreview,
  QuestionnaireVersionList,
  QuestionnaireVersionSummary,
  QuestionnaireVersionView,
} from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, RequirePermission } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import type { QuestionnaireVersion } from '../domain/publication.js';
import {
  getVersion,
  listVersions,
  previewPublication,
  publishQuestionnaire,
} from '../application/publication.js';
import type { SurveysDeps } from '../application/surveys-deps.js';
import { httpError } from './http-errors.js';
import { SURVEYS_DEPS } from './surveys.tokens.js';

const toSummary = (v: QuestionnaireVersion): QuestionnaireVersionSummary => ({
  id: v.id,
  number: v.number,
  publishedAt: v.publishedAt.toISOString(),
  questionCount: v.snapshot.questions.length,
  changes: [...v.changes],
});

const toView = (v: QuestionnaireVersion): QuestionnaireVersionView => ({
  ...toSummary(v),
  snapshot: v.snapshot,
});

const IdParam = new ZodValidationPipe(Id);

/** Publication and published versions of the questionnaire (spec 015). */
@Controller('v1/surveys/:id')
@RequirePermission('surveys.manage')
export class VersionsController {
  constructor(@Inject(SURVEYS_DEPS) private readonly deps: SurveysDeps) {}

  @Get('questionnaire/publication')
  @RequirePermission('surveys.publish')
  async preview(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
  ): Promise<PublicationPreview> {
    const result = await previewPublication(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    const { issues, tseMissing, changes, ...rest } = result.value;
    return { ...rest, issues: [...issues], tseMissing: [...tseMissing], changes: [...changes] };
  }

  @Post('questionnaire/publish')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('surveys.publish')
  async publish(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
    @Body(new ZodValidationPipe(PublishQuestionnaireRequest)) body: PublishQuestionnaireRequest,
  ): Promise<QuestionnaireVersionSummary> {
    const result = await publishQuestionnaire(this.deps, actor, id, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toSummary(result.value);
  }

  @Get('versions')
  async list(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
  ): Promise<QuestionnaireVersionList> {
    const result = await listVersions(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return { items: result.value.map(toSummary) };
  }

  @Get('versions/:number')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<QuestionnaireVersionView> {
    const result = await getVersion(this.deps, actor, id, number);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toView(result.value);
  }
}
