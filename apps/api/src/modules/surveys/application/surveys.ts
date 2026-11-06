import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { Survey } from '../domain/survey.js';
import type { SurveyChanges, SurveyFields, SurveyStateError } from '../domain/survey.js';
import { asManager } from './authorization.js';
import type { Actor } from './ports.js';
import type { SurveysDeps } from './surveys-deps.js';
import { toSurveyDetails } from './views.js';
import type { SurveyDetails } from './views.js';

/** Title of a duplicated survey (UI text in pt-BR, ADR-0001). */
export const COPY_PREFIX = 'Cópia de ';

export interface SurveySummaryDetails {
  readonly id: string;
  readonly title: string;
  readonly type: SurveyDetails['type'];
  readonly status: SurveyDetails['status'];
  readonly clientId: string | null;
  readonly clientName: string | null;
  readonly fieldStart: string | null;
  readonly fieldEnd: string | null;
  readonly targetInterviews: number | null;
  readonly municipalityCount: number;
  readonly updatedAt: Date;
}

/**
 * The client's name, or CLIENT_NOT_FOUND when the id is not of this organization
 * (RLS). With `lock`, a client being deleted at the same time is waited for.
 */
const clientNameOf = async (
  deps: SurveysDeps,
  clientId: string | null,
  options: { lock?: boolean } = {},
): Promise<Result<string | null, 'CLIENT_NOT_FOUND'>> => {
  if (clientId === null) {
    return ok(null);
  }
  const client = await deps.clients.findById(clientId, { forUpdate: options.lock === true });
  return client ? ok(client.name) : err('CLIENT_NOT_FOUND');
};

/** Loads the client name of a survey already stored (its client cannot vanish: FK). */
const detailsOf = async (deps: SurveysDeps, survey: Survey): Promise<SurveyDetails> => {
  const name = await clientNameOf(deps, survey.clientId);
  return toSurveyDetails(survey, name.ok ? name.value : null);
};

export const listSurveys = (
  deps: SurveysDeps,
  actor: Actor,
): Promise<Result<SurveySummaryDetails[], 'FORBIDDEN'>> =>
  asManager(deps, actor, async () => {
    const [surveys, clients] = await Promise.all([deps.surveys.list(), deps.clients.list()]);
    const names = new Map(clients.map((client) => [client.id, client.name]));
    const items = surveys
      .map((survey): SurveySummaryDetails => {
        const s = survey.toSnapshot();
        return {
          id: s.id,
          title: s.title,
          type: s.type,
          status: s.status,
          clientId: s.clientId,
          clientName: s.clientId === null ? null : (names.get(s.clientId) ?? null),
          fieldStart: s.fieldStart,
          fieldEnd: s.fieldEnd,
          targetInterviews: s.targetInterviews,
          municipalityCount: s.municipalityCodes.length,
          updatedAt: s.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return ok(items);
  });

export const getSurvey = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
): Promise<Result<SurveyDetails, 'FORBIDDEN' | 'SURVEY_NOT_FOUND'>> =>
  asManager(deps, actor, async () => {
    const survey = await deps.surveys.findById(surveyId);
    return survey ? ok(await detailsOf(deps, survey)) : err('SURVEY_NOT_FOUND');
  });

export const createSurvey = (
  deps: SurveysDeps,
  actor: Actor,
  input: SurveyFields,
): Promise<Result<SurveyDetails, 'FORBIDDEN' | 'CLIENT_NOT_FOUND'>> =>
  asManager(deps, actor, async () => {
    const clientName = await clientNameOf(deps, input.clientId, { lock: true });
    if (!clientName.ok) {
      return clientName;
    }
    const survey = Survey.create({
      id: deps.ids.next(),
      organizationId: actor.organizationId,
      now: deps.clock.now(),
      fields: input,
    });
    await deps.surveys.add(survey);
    await deps.audit.record({
      action: 'survey.created',
      actorUserId: actor.userId,
      entity: 'survey',
      entityId: survey.id,
    });
    return ok(toSurveyDetails(survey, clientName.value));
  });

type UpdateError = 'FORBIDDEN' | 'SURVEY_NOT_FOUND' | 'CLIENT_NOT_FOUND' | SurveyStateError;

export const updateSurvey = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
  changes: SurveyChanges,
): Promise<Result<SurveyDetails, UpdateError>> =>
  asManager(deps, actor, async (): Promise<Result<SurveyDetails, UpdateError>> => {
    const survey = await deps.surveys.findById(surveyId, { forUpdate: true });
    if (!survey) {
      return err('SURVEY_NOT_FOUND');
    }
    if (changes.clientId !== undefined) {
      const client = await clientNameOf(deps, changes.clientId, { lock: true });
      if (!client.ok) {
        return client;
      }
    }
    const result = survey.update(changes, deps.clock.now());
    if (!result.ok) {
      return result;
    }
    if (result.value.changed.length > 0) {
      await deps.surveys.save(survey);
      await deps.audit.record({
        action: 'survey.updated',
        actorUserId: actor.userId,
        entity: 'survey',
        entityId: survey.id,
        metadata: { changed: result.value.changed },
      });
    }
    return ok(await detailsOf(deps, survey));
  });

const changeStatus = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
  transition: 'archive' | 'unarchive',
): Promise<Result<SurveyDetails, 'FORBIDDEN' | 'SURVEY_NOT_FOUND' | SurveyStateError>> =>
  asManager(
    deps,
    actor,
    async (): Promise<Result<SurveyDetails, 'SURVEY_NOT_FOUND' | SurveyStateError>> => {
      const survey = await deps.surveys.findById(surveyId, { forUpdate: true });
      if (!survey) {
        return err('SURVEY_NOT_FOUND');
      }
      const now = deps.clock.now();
      const result = transition === 'archive' ? survey.archive(now) : survey.unarchive(now);
      if (!result.ok) {
        return result;
      }
      await deps.surveys.save(survey);
      await deps.audit.record({
        action: transition === 'archive' ? 'survey.archived' : 'survey.unarchived',
        actorUserId: actor.userId,
        entity: 'survey',
        entityId: survey.id,
      });
      return ok(await detailsOf(deps, survey));
    },
  );

export const archiveSurvey = (deps: SurveysDeps, actor: Actor, surveyId: string) =>
  changeStatus(deps, actor, surveyId, 'archive');

export const unarchiveSurvey = (deps: SurveysDeps, actor: Actor, surveyId: string) =>
  changeStatus(deps, actor, surveyId, 'unarchive');

export const duplicateSurvey = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
): Promise<Result<SurveyDetails, 'FORBIDDEN' | 'SURVEY_NOT_FOUND'>> =>
  asManager(deps, actor, async () => {
    const original = await deps.surveys.findById(surveyId);
    if (!original) {
      return err('SURVEY_NOT_FOUND');
    }
    const copy = original.duplicate({
      id: deps.ids.next(),
      title: `${COPY_PREFIX}${original.title}`,
      now: deps.clock.now(),
    });
    await deps.surveys.add(copy);
    // The copy takes the questionnaire draft too, with new ids (spec 014 rule 15).
    const questionnaire = await deps.questionnaires.find(original.id);
    if (questionnaire) {
      await deps.questionnaires.save(
        questionnaire.copyFor({
          surveyId: copy.id,
          now: deps.clock.now(),
          by: actor.userId,
          newId: () => deps.ids.next(),
        }),
      );
    }
    await deps.audit.record({
      action: 'survey.duplicated',
      actorUserId: actor.userId,
      entity: 'survey',
      entityId: copy.id,
      metadata: { sourceSurveyId: original.id, questionCount: questionnaire?.questionCount ?? 0 },
    });
    return ok(await detailsOf(deps, copy));
  });

export const deleteSurvey = (
  deps: SurveysDeps,
  actor: Actor,
  surveyId: string,
): Promise<Result<void, 'FORBIDDEN' | 'SURVEY_NOT_FOUND' | SurveyStateError>> =>
  asManager(deps, actor, async (): Promise<Result<void, 'SURVEY_NOT_FOUND' | SurveyStateError>> => {
    const survey = await deps.surveys.findById(surveyId, { forUpdate: true });
    if (!survey) {
      return err('SURVEY_NOT_FOUND');
    }
    if (!survey.canBeDeleted()) {
      return err('SURVEY_NOT_EDITABLE');
    }
    await deps.surveys.remove(survey.id);
    await deps.audit.record({
      action: 'survey.deleted',
      actorUserId: actor.userId,
      entity: 'survey',
      entityId: survey.id,
    });
    return ok(undefined);
  });
