import { Body, Controller, Get, Inject, Param, Put } from '@nestjs/common';
import { Id, SaveQuestionnaireRequest } from '@az-pesquisas/contracts';
import type { QuestionnaireView } from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, RequirePermission } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import { getQuestionnaire, saveQuestionnaire } from '../application/questionnaires.js';
import type { QuestionnaireDetails } from '../application/questionnaires.js';
import type { SurveysDeps } from '../application/surveys-deps.js';
import { httpError } from './http-errors.js';
import { SURVEYS_DEPS } from './surveys.tokens.js';

const toView = (q: QuestionnaireDetails): QuestionnaireView => ({
  ...q,
  updatedAt: q.updatedAt?.toISOString() ?? null,
});

/** The questionnaire draft of a survey (spec 014). */
@Controller('v1/surveys/:id/questionnaire')
@RequirePermission('surveys.manage')
export class QuestionnairesController {
  constructor(@Inject(SURVEYS_DEPS) private readonly deps: SurveysDeps) {}

  @Get()
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
  ): Promise<QuestionnaireView> {
    const result = await getQuestionnaire(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toView(result.value);
  }

  @Put()
  async save(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
    @Body(new ZodValidationPipe(SaveQuestionnaireRequest)) body: SaveQuestionnaireRequest,
  ): Promise<QuestionnaireView> {
    const result = await saveQuestionnaire(this.deps, actor, id, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toView(result.value);
  }
}
