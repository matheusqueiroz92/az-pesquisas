import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { planPublication } from '../domain/publication.js';
import type {
  PublicationBlocker,
  PublicationPlan,
  QuestionnaireVersion,
} from '../domain/publication.js';
import { Questionnaire } from '../domain/questionnaire.js';
import { asManager, withPermission } from './authorization.js';
import type { Actor } from './ports.js';
import type { SurveysDeps } from './surveys-deps.js';

export interface PublicationPreviewDetails extends Omit<PublicationPlan, 'snapshot'> {
  readonly revision: number;
}

const draftOf = async (deps: SurveysDeps, surveyId: string, organizationId: string) =>
  (await deps.questionnaires.find(surveyId)) ?? Questionnaire.empty(surveyId, organizationId);

/** What publishing now would do (spec 015 rule 7), without publishing. */
export const previewPublication = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
): Promise<Result<PublicationPreviewDetails, 'FORBIDDEN' | 'SURVEY_NOT_FOUND'>> =>
  withPermission(deps, actor, 'surveys.publish', async () => {
    const survey = await deps.surveys.findById(surveyId);
    if (!survey) {
      return err('SURVEY_NOT_FOUND');
    }
    const draft = await draftOf(deps, survey.id, actor.organizationId);
    const { snapshot: _snapshot, ...plan } = planPublication({
      survey,
      draft: draft.toSnapshot().content,
      previous: await deps.versions.latest(survey.id),
      versionId: deps.ids.next(),
    });
    return ok({ ...plan, revision: draft.revision });
  });

type PublishError =
  'FORBIDDEN' | 'SURVEY_NOT_FOUND' | 'QUESTIONNAIRE_CONFLICT' | PublicationBlocker;

/**
 * Publishes the saved draft the coordinator reviewed as the next immutable
 * version (spec 015). The survey row lock serializes publications and saves.
 */
export const publishQuestionnaire = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
  input: { revision: number },
): Promise<Result<QuestionnaireVersion, PublishError>> =>
  withPermission(
    deps,
    actor,
    'surveys.publish',
    async (): Promise<Result<QuestionnaireVersion, Exclude<PublishError, 'FORBIDDEN'>>> => {
      const survey = await deps.surveys.findById(surveyId, { forUpdate: true });
      if (!survey) {
        return err('SURVEY_NOT_FOUND');
      }
      const draft = await draftOf(deps, survey.id, actor.organizationId);
      if (draft.revision !== input.revision) {
        return err('QUESTIONNAIRE_CONFLICT');
      }
      const versionId = deps.ids.next();
      const plan = planPublication({
        survey,
        draft: draft.toSnapshot().content,
        previous: await deps.versions.latest(survey.id),
        versionId,
      });
      if (plan.blocker || !plan.snapshot) {
        return err(plan.blocker ?? 'QUESTIONNAIRE_NOT_PUBLISHABLE');
      }
      const now = deps.clock.now();
      const marked = survey.markPublished(plan.nextVersionNumber, now);
      if (!marked.ok) {
        return marked;
      }
      const version: QuestionnaireVersion = {
        id: versionId,
        organizationId: actor.organizationId,
        surveyId: survey.id,
        number: plan.nextVersionNumber,
        snapshot: plan.snapshot,
        changes: plan.changes,
        publishedAt: now,
        publishedBy: actor.userId,
      };
      await deps.versions.add(version);
      await deps.surveys.save(survey);
      await deps.audit.record({
        action: 'questionnaire.published',
        actorUserId: actor.userId,
        entity: 'questionnaire_version',
        entityId: version.id,
        metadata: {
          surveyId: survey.id,
          versionNumber: version.number,
          questionCount: version.snapshot.questions.length,
          changeKinds: [...new Set(version.changes.map((c) => c.kind))],
        },
      });
      return ok(version);
    },
  );

export const listVersions = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
): Promise<Result<QuestionnaireVersion[], 'FORBIDDEN' | 'SURVEY_NOT_FOUND'>> =>
  asManager(deps, actor, async () => {
    const survey = await deps.surveys.findById(surveyId);
    return survey ? ok(await deps.versions.list(survey.id)) : err('SURVEY_NOT_FOUND');
  });

export const getVersion = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
  number: number,
): Promise<
  Result<QuestionnaireVersion, 'FORBIDDEN' | 'SURVEY_NOT_FOUND' | 'QUESTIONNAIRE_VERSION_NOT_FOUND'>
> =>
  asManager(deps, actor, async () => {
    const survey = await deps.surveys.findById(surveyId);
    if (!survey) {
      return err('SURVEY_NOT_FOUND');
    }
    const version = await deps.versions.findByNumber(survey.id, number);
    return version ? ok(version) : err('QUESTIONNAIRE_VERSION_NOT_FOUND');
  });
