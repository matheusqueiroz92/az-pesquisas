import { describe, expect, it } from 'vitest';

import {
  createPairing,
  getPairing,
  heartbeat,
  listDevices,
  pairDevice,
  renameDevice,
  revokeDevice,
} from '../devices.js';
import { getSurveyTeam, updateSurveyTeam } from '../teams.js';
import { actorOf, createFakes, ORG_A, ORG_B } from './fakes.js';
import type { createFakes as Factory } from './fakes.js';

const coordinator = actorOf('coordinator');
const DEVICE = {
  platform: 'android' as const,
  model: 'SM-X200',
  osVersion: '14',
  appVersion: '0.1.0',
};
const BEAT = {
  appVersion: '0.2.0',
  batteryLevel: null,
  pendingInterviews: 0,
  pendingMediaBytes: 0,
  storageFreeBytes: null,
  lastSyncError: null,
};
const SURVEY = '0193a000-0000-7000-8000-0000000005a1';
const INTERVIEWER = '0193a000-0000-7000-8000-0000000006a1';

type Fakes = ReturnType<typeof Factory>;

const pair = async (fakes: Fakes, actor = coordinator) => {
  const created = await createPairing(fakes.deps, actor);
  if (!created.ok) {
    throw new Error(created.error);
  }
  const paired = await pairDevice(fakes.deps, { code: created.value.code, device: DEVICE });
  if (!paired.ok) {
    throw new Error(paired.error);
  }
  return { pairing: created.value, ...paired.value };
};

describe('pairing (CA-01, CA-02)', () => {
  it('pairs once with a fresh code and names the device', async () => {
    const fakes = createFakes();
    const created = await createPairing(fakes.deps, coordinator);
    expect(created).toMatchObject({ ok: true, value: { code: '100001' } });
    if (!created.ok) {
      throw new Error();
    }
    expect([...fakes.pairings.values()][0]?.codeHash).toBe('hash(100001)');
    expect(created.value.expiresAt.toISOString()).toBe('2026-11-06T12:10:00.000Z');

    const pending = await getPairing(fakes.deps, coordinator, created.value.id);
    expect(pending).toMatchObject({ ok: true, value: { status: 'pending', device: null } });

    const paired = await pairDevice(fakes.deps, { code: '100001', device: DEVICE });
    expect(paired).toMatchObject({
      ok: true,
      value: { organization: { id: ORG_A, name: 'Instituto A' } },
    });
    if (!paired.ok) {
      throw new Error();
    }
    const stored = fakes.devices.get(paired.value.deviceId);
    expect(stored).toMatchObject({ nickname: 'Aparelho 1', model: 'SM-X200', revokedAt: null });
    expect(stored?.tokenHash).toBe(`hash(${paired.value.deviceToken})`);

    expect(await getPairing(fakes.deps, coordinator, created.value.id)).toMatchObject({
      ok: true,
      value: { status: 'paired', device: { nickname: 'Aparelho 1' } },
    });
    expect(await pairDevice(fakes.deps, { code: '100001', device: DEVICE })).toEqual({
      ok: false,
      error: 'PAIRING_CODE_INVALID',
    });
    expect(fakes.auditEntries.map((e) => e.action)).toEqual([
      'device.pairing_created',
      'device.paired',
    ]);
  });

  it('refuses an unknown or expired code the same way', async () => {
    const fakes = createFakes();
    const created = await createPairing(fakes.deps, coordinator);
    expect(await pairDevice(fakes.deps, { code: '999999', device: DEVICE })).toEqual({
      ok: false,
      error: 'PAIRING_CODE_INVALID',
    });
    fakes.advance(10 * 60 * 1000);
    expect(await pairDevice(fakes.deps, { code: '100001', device: DEVICE })).toEqual({
      ok: false,
      error: 'PAIRING_CODE_INVALID',
    });
    expect(
      created.ok && (await getPairing(fakes.deps, coordinator, created.value.id)),
    ).toMatchObject({
      ok: true,
      value: { status: 'expired' },
    });
  });

  it('draws another code when the digits are pending elsewhere', async () => {
    const fakes = createFakes({ codes: ['111111', '111111', '222222'] });
    await createPairing(fakes.deps, coordinator);
    const second = await createPairing(fakes.deps, actorOf('admin', ORG_B));
    expect(second).toMatchObject({ ok: true, value: { code: '222222' } });
  });

  it('gives up after five collisions', async () => {
    const fakes = createFakes({ codes: Array.from({ length: 6 }, () => '333333') });
    await createPairing(fakes.deps, coordinator);
    await expect(createPairing(fakes.deps, coordinator)).rejects.toThrow(/free pairing code/);
  });

  it('numbers devices per organization', async () => {
    const fakes = createFakes();
    await pair(fakes);
    const second = await pair(fakes);
    const other = await pair(fakes, actorOf('admin', ORG_B));
    expect(fakes.devices.get(second.deviceId)?.nickname).toBe('Aparelho 2');
    expect(fakes.devices.get(other.deviceId)?.nickname).toBe('Aparelho 1');
  });
});

describe('heartbeat (CA-03)', () => {
  it('updates last seen and app version; refuses unknown and revoked tokens', async () => {
    const fakes = createFakes();
    const { deviceId, deviceToken } = await pair(fakes);
    fakes.advance(60_000);
    expect(await heartbeat(fakes.deps, deviceToken, BEAT)).toEqual({
      ok: true,
      value: {
        serverTime: new Date('2026-11-06T12:01:00Z'),
        minimumAppVersion: '0.1.0',
        policy: { deleteSyncedAfterDays: 30 },
      },
    });
    expect(fakes.devices.get(deviceId)).toMatchObject({
      appVersion: '0.2.0',
      lastSeenAt: new Date('2026-11-06T12:01:00Z'),
    });
    expect(await heartbeat(fakes.deps, 'nope', BEAT)).toEqual({
      ok: false,
      error: 'DEVICE_TOKEN_INVALID',
    });
    await revokeDevice(fakes.deps, coordinator, deviceId);
    expect(await heartbeat(fakes.deps, deviceToken, BEAT)).toEqual({
      ok: false,
      error: 'DEVICE_TOKEN_INVALID',
    });
  });
});

describe('managing devices (CA-04)', () => {
  it('lists, renames and revokes, leaving every team', async () => {
    const fakes = createFakes();
    fakes.addSurvey({ id: SURVEY, organizationId: ORG_A, title: 'Pesquisa', status: 'in_field' });
    const { deviceId } = await pair(fakes);
    await updateSurveyTeam(fakes.deps, coordinator, SURVEY, {
      deviceIds: [deviceId],
      interviewerIds: [],
    });

    expect(await listDevices(fakes.deps, coordinator)).toMatchObject({
      ok: true,
      value: [{ id: deviceId, surveys: [{ id: SURVEY, title: 'Pesquisa', status: 'in_field' }] }],
    });
    expect(await renameDevice(fakes.deps, coordinator, deviceId, ' Tablet 03 ')).toMatchObject({
      ok: true,
      value: { nickname: 'Tablet 03' },
    });
    expect(await renameDevice(fakes.deps, coordinator, deviceId, 'Tablet 03')).toMatchObject({
      ok: true,
    });
    expect(fakes.auditEntries.filter((e) => e.action === 'device.renamed')).toHaveLength(1);

    const revoked = await revokeDevice(fakes.deps, coordinator, deviceId);
    expect(revoked).toMatchObject({ ok: true, value: { surveys: [] } });
    expect(fakes.devices.get(deviceId)?.revokedAt).not.toBeNull();
    expect(await revokeDevice(fakes.deps, coordinator, deviceId)).toEqual({
      ok: false,
      error: 'DEVICE_REVOKED',
    });
    expect(await renameDevice(fakes.deps, coordinator, deviceId, 'Outro')).toEqual({
      ok: false,
      error: 'DEVICE_REVOKED',
    });
    expect(
      await updateSurveyTeam(fakes.deps, coordinator, SURVEY, {
        deviceIds: [deviceId],
        interviewerIds: [],
      }),
    ).toEqual({ ok: false, error: 'DEVICE_REVOKED' });
  });

  it('answers DEVICE_NOT_FOUND across organizations', async () => {
    const fakes = createFakes();
    const { deviceId } = await pair(fakes);
    const other = actorOf('admin', ORG_B);
    expect(await renameDevice(fakes.deps, other, deviceId, 'Meu')).toEqual({
      ok: false,
      error: 'DEVICE_NOT_FOUND',
    });
    expect(await revokeDevice(fakes.deps, other, deviceId)).toEqual({
      ok: false,
      error: 'DEVICE_NOT_FOUND',
    });
    expect(await listDevices(fakes.deps, other)).toEqual({ ok: true, value: [] });
    expect(await getPairing(fakes.deps, other, deviceId)).toEqual({
      ok: false,
      error: 'PAIRING_NOT_FOUND',
    });
  });
});

describe('survey team (CA-05)', () => {
  const setup = async () => {
    const fakes = createFakes();
    fakes.addSurvey({ id: SURVEY, organizationId: ORG_A, title: 'Pesquisa', status: 'in_field' });
    fakes.addInterviewer({
      id: INTERVIEWER,
      organizationId: ORG_A,
      name: 'Ana',
      email: 'ana@a.com',
    });
    const { deviceId } = await pair(fakes);
    return { fakes, deviceId };
  };

  it('saves devices and interviewers and shows who is in', async () => {
    const { fakes, deviceId } = await setup();
    expect(await getSurveyTeam(fakes.deps, coordinator, SURVEY)).toMatchObject({
      ok: true,
      value: {
        devices: [{ id: deviceId, assigned: false }],
        interviewers: [{ id: INTERVIEWER, name: 'Ana', assigned: false }],
      },
    });
    const updated = await updateSurveyTeam(fakes.deps, coordinator, SURVEY, {
      deviceIds: [deviceId],
      interviewerIds: [INTERVIEWER],
    });
    expect(updated).toMatchObject({
      ok: true,
      value: { devices: [{ assigned: true }], interviewers: [{ assigned: true }] },
    });
    expect(fakes.auditEntries.at(-1)).toMatchObject({
      action: 'survey.team_updated',
      metadata: { devicesBefore: 0, devicesAfter: 1, interviewersBefore: 0, interviewersAfter: 1 },
    });
  });

  it('refuses unknown members, other people and closed or archived surveys', async () => {
    const { fakes, deviceId } = await setup();
    const call = (input: { deviceIds: string[]; interviewerIds: string[] }, surveyId = SURVEY) =>
      updateSurveyTeam(fakes.deps, coordinator, surveyId, input);
    expect(await call({ deviceIds: [SURVEY], interviewerIds: [] })).toEqual({
      ok: false,
      error: 'DEVICE_NOT_FOUND',
    });
    expect(await call({ deviceIds: [], interviewerIds: [deviceId] })).toEqual({
      ok: false,
      error: 'INTERVIEWER_NOT_FOUND',
    });
    expect(await call({ deviceIds: [], interviewerIds: [] }, INTERVIEWER)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_FOUND',
    });
    expect(await getSurveyTeam(fakes.deps, coordinator, INTERVIEWER)).toEqual({
      ok: false,
      error: 'SURVEY_NOT_FOUND',
    });
    for (const status of ['closed', 'archived'] as const) {
      const id = `0193a000-0000-7000-8000-0000000005${status === 'closed' ? 'b1' : 'c1'}`;
      fakes.addSurvey({ id, organizationId: ORG_A, title: status, status });
      expect(await call({ deviceIds: [], interviewerIds: [] }, id)).toEqual({
        ok: false,
        error: 'SURVEY_NOT_ASSIGNABLE',
      });
    }
  });

  it('is forbidden to other roles (CA-07)', async () => {
    const { fakes } = await setup();
    for (const role of ['analyst', 'client', 'interviewer'] as const) {
      const actor = actorOf(role);
      for (const call of [
        () => createPairing(fakes.deps, actor),
        () => listDevices(fakes.deps, actor),
        () => getSurveyTeam(fakes.deps, actor, SURVEY),
        () => updateSurveyTeam(fakes.deps, actor, SURVEY, { deviceIds: [], interviewerIds: [] }),
      ]) {
        expect(await call()).toEqual({ ok: false, error: 'FORBIDDEN' });
      }
    }
  });
});
