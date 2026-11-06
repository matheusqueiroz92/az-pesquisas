import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';
import type { QuestionnaireDraft, QuestionnaireLock } from '@az-pesquisas/contracts';

import { Questionnaire } from '../domain/questionnaire.js';
import { asManager } from './authorization.js';
import type { Actor } from './ports.js';
import type { SurveysDeps } from './surveys-deps.js';

export interface QuestionnaireDetails {
  readonly surveyId: string;
  readonly revision: number;
  readonly content: QuestionnaireDraft;
  readonly lock: QuestionnaireLock | null;
  readonly updatedAt: Date | null;
}

const detailsOf = (q: Questionnaire, lock: QuestionnaireLock | null): QuestionnaireDetails => {
  const { surveyId, revision, content, updatedAt } = q.toSnapshot();
  return { surveyId, revision, content, lock, updatedAt };
};

export const getQuestionnaire = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
): Promise<Result<QuestionnaireDetails, 'FORBIDDEN' | 'SURVEY_NOT_FOUND'>> =>
  asManager(deps, actor, async () => {
    const survey = await deps.surveys.findById(surveyId);
    if (!survey) {
      return err('SURVEY_NOT_FOUND');
    }
    const questionnaire =
      (await deps.questionnaires.find(survey.id)) ??
      Questionnaire.empty(survey.id, actor.organizationId);
    return ok(detailsOf(questionnaire, survey.questionnaireLock()));
  });

type SaveError =
  'FORBIDDEN' | 'SURVEY_NOT_FOUND' | 'QUESTIONNAIRE_LOCKED' | 'QUESTIONNAIRE_CONFLICT';

/**
 * Saves the whole draft (spec 014). Autosaves are not audited (one per pause
 * while typing); publication is (spec 015). The survey row lock serializes
 * concurrent saves, so the revision check is reliable.
 */
export const saveQuestionnaire = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
  input: { revision: number; content: QuestionnaireDraft },
): Promise<Result<QuestionnaireDetails, SaveError>> =>
  asManager(
    deps,
    actor,
    async (): Promise<Result<QuestionnaireDetails, Exclude<SaveError, 'FORBIDDEN'>>> => {
      const survey = await deps.surveys.findById(surveyId, { forUpdate: true });
      if (!survey) {
        return err('SURVEY_NOT_FOUND');
      }
      if (survey.questionnaireLock() !== null) {
        return err('QUESTIONNAIRE_LOCKED');
      }
      const questionnaire =
        (await deps.questionnaires.find(survey.id)) ??
        Questionnaire.empty(survey.id, actor.organizationId);
      const replaced = questionnaire.replace(input.content, {
        expectedRevision: input.revision,
        now: deps.clock.now(),
        by: actor.userId,
      });
      if (!replaced.ok) {
        return replaced;
      }
      await deps.questionnaires.save(questionnaire);
      return ok(detailsOf(questionnaire, null));
    },
  );
