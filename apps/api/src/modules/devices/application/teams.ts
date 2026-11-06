import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import type { DevicesDeps } from './devices-deps.js';
import { asDeviceManager } from './devices.js';
import type { Actor } from './ports.js';

export interface SurveyTeamDetails {
  readonly devices: { id: string; nickname: string; model: string; assigned: boolean }[];
  readonly interviewers: { id: string; name: string; email: string; assigned: boolean }[];
}

const teamOf = async (deps: DevicesDeps, surveyId: string): Promise<SurveyTeamDetails> => {
  const team = await deps.teams.of(surveyId);
  const devices = (await deps.devices.list()).filter((d) => d.isActive);
  const interviewers = await deps.people.activeInterviewers();
  return {
    devices: devices.map((d) => {
      const { id, nickname, model } = d.toSnapshot();
      return { id, nickname, model, assigned: team.deviceIds.includes(id) };
    }),
    interviewers: interviewers.map((i) => ({ ...i, assigned: team.interviewerIds.includes(i.id) })),
  };
};

/** Active devices and interviewers, marked when they are in the survey's team (rule 10). */
export const getSurveyTeam = (
  deps: DevicesDeps,
  actor: Actor,
  surveyId: string,
): Promise<Result<SurveyTeamDetails, 'FORBIDDEN' | 'SURVEY_NOT_FOUND'>> =>
  asDeviceManager(deps, actor, async () => {
    const [survey] = await deps.surveys.find([surveyId]);
    if (!survey) {
      return err('SURVEY_NOT_FOUND');
    }
    return ok(await teamOf(deps, survey.id));
  });

type TeamError =
  | 'FORBIDDEN'
  | 'SURVEY_NOT_FOUND'
  | 'SURVEY_NOT_ASSIGNABLE'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_REVOKED'
  | 'INTERVIEWER_NOT_FOUND';

/** Replaces the team of a draft or in-field survey (rules 10 and 11). */
export const updateSurveyTeam = (
  deps: DevicesDeps,
  actor: Actor,
  surveyId: string,
  input: { deviceIds: readonly string[]; interviewerIds: readonly string[] },
): Promise<Result<SurveyTeamDetails, TeamError>> =>
  asDeviceManager(deps, actor, async (): Promise<Result<SurveyTeamDetails, TeamError>> => {
    const [survey] = await deps.surveys.find([surveyId]);
    if (!survey) {
      return err('SURVEY_NOT_FOUND');
    }
    if (survey.status !== 'draft' && survey.status !== 'in_field') {
      return err('SURVEY_NOT_ASSIGNABLE');
    }
    for (const deviceId of input.deviceIds) {
      const device = await deps.devices.findById(deviceId);
      if (!device) {
        return err('DEVICE_NOT_FOUND');
      }
      if (!device.isActive) {
        return err('DEVICE_REVOKED');
      }
    }
    const interviewers = new Set((await deps.people.activeInterviewers()).map((i) => i.id));
    if (!input.interviewerIds.every((id) => interviewers.has(id))) {
      return err('INTERVIEWER_NOT_FOUND');
    }
    const before = await deps.teams.of(survey.id);
    await deps.teams.replace({
      surveyId: survey.id,
      deviceIds: input.deviceIds,
      interviewerIds: input.interviewerIds,
      by: actor.userId,
      now: deps.clock.now(),
    });
    await deps.audit.record({
      action: 'survey.team_updated',
      actorUserId: actor.userId,
      entity: 'survey',
      entityId: survey.id,
      metadata: {
        devicesBefore: before.deviceIds.length,
        devicesAfter: input.deviceIds.length,
        interviewersBefore: before.interviewerIds.length,
        interviewersAfter: input.interviewerIds.length,
      },
    });
    return ok(await teamOf(deps, survey.id));
  });
