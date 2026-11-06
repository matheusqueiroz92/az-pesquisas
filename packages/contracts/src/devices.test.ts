import { describe, expect, it } from 'vitest';

import { UpdateDeviceRequest, UpdateSurveyTeamRequest } from './devices.js';

const ID = '0193a000-0000-7000-8000-000000000001';

describe('devices contracts (spec 016)', () => {
  it('validates nickname and team', () => {
    expect(UpdateDeviceRequest.parse({ nickname: ' Tablet 03 ' })).toEqual({
      nickname: 'Tablet 03',
    });
    expect(UpdateDeviceRequest.safeParse({ nickname: 'x' }).success).toBe(false);
    expect(
      UpdateSurveyTeamRequest.safeParse({ deviceIds: [ID, ID], interviewerIds: [] }).success,
    ).toBe(false);
    expect(
      UpdateSurveyTeamRequest.parse({ deviceIds: [ID], interviewerIds: [] }).deviceIds,
    ).toEqual([ID]);
    expect(
      UpdateSurveyTeamRequest.safeParse({ deviceIds: [], interviewerIds: [], extra: 1 }).success,
    ).toBe(false);
  });
});
