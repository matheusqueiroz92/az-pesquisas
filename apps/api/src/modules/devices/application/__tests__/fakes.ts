import type { SurveyStatus } from '@az-pesquisas/contracts';

import { currentOrganizationId } from '../../../../shared/tenancy/tenant-context.js';
import { Device } from '../../domain/device.js';
import type { DeviceSnapshot } from '../../domain/device.js';
import { Pairing } from '../../domain/pairing.js';
import type { PairingSnapshot } from '../../domain/pairing.js';
import type { DevicesDeps } from '../devices-deps.js';
import type { Actor, AuditAction } from '../ports.js';

export const ORG_A = '0193a000-0000-7000-8000-00000000a000';
export const ORG_B = '0193a000-0000-7000-8000-00000000b000';

export const actorOf = (role: Actor['role'], organizationId: string = ORG_A): Actor => ({
  userId: '0193a000-0000-7000-8000-0000000000c9',
  organizationId,
  role,
  sessionId: 'no-session',
});

interface SurveyRow {
  id: string;
  organizationId: string;
  title: string;
  status: SurveyStatus;
}
interface PersonRow {
  id: string;
  organizationId: string;
  name: string;
  email: string;
}
interface TeamRow {
  organizationId: string;
  surveyId: string;
  memberId: string;
  kind: 'device' | 'interviewer';
}

/** In-memory doubles: reads filter by the current tenant, like RLS. */
export const createFakes = (options: { codes?: string[] } = {}) => {
  let now = new Date('2026-11-06T12:00:00Z');
  let idCounter = 0;
  let tokenCounter = 0;
  const codes = [...(options.codes ?? [])];
  let codeCounter = 100000;
  const devices = new Map<string, DeviceSnapshot>();
  const pairings = new Map<string, PairingSnapshot>();
  const team: TeamRow[] = [];
  const surveys: SurveyRow[] = [];
  const people: PersonRow[] = [];
  const auditEntries: { action: AuditAction; organizationId: string; metadata?: unknown }[] = [];
  const org = () => currentOrganizationId();
  const mine = <T extends { organizationId: string }>(rows: Iterable<T>) =>
    [...rows].filter((r) => r.organizationId === org());

  const deps: DevicesDeps = {
    devices: {
      findById: (id) => {
        const row = devices.get(id);
        return Promise.resolve(
          row?.organizationId === org() ? Device.fromSnapshot(row) : undefined,
        );
      },
      list: () =>
        Promise.resolve(
          mine(devices.values())
            .sort((a, b) => b.pairedAt.getTime() - a.pairedAt.getTime())
            .map((r) => Device.fromSnapshot(r)),
        ),
      count: () => Promise.resolve(mine(devices.values()).length),
      add: (device) => {
        devices.set(device.id, device.toSnapshot());
        return Promise.resolve();
      },
      save: (device) => {
        devices.set(device.id, device.toSnapshot());
        return Promise.resolve();
      },
    },
    pairings: {
      findById: (id) => {
        const row = pairings.get(id);
        return Promise.resolve(
          row?.organizationId === org() ? Pairing.fromSnapshot(row) : undefined,
        );
      },
      add: (pairing) => {
        const row = pairing.toSnapshot();
        // Partial unique index: one PENDING pairing per code hash, in any organization.
        if ([...pairings.values()].some((p) => p.codeHash === row.codeHash && !p.consumedAt)) {
          return Promise.resolve(false);
        }
        pairings.set(row.id, row);
        return Promise.resolve(true);
      },
      save: (pairing) => {
        pairings.set(pairing.id, pairing.toSnapshot());
        return Promise.resolve();
      },
    },
    teams: {
      of: (surveyId) => {
        const rows = mine(team).filter((r) => r.surveyId === surveyId);
        return Promise.resolve({
          deviceIds: rows.filter((r) => r.kind === 'device').map((r) => r.memberId),
          interviewerIds: rows.filter((r) => r.kind === 'interviewer').map((r) => r.memberId),
        });
      },
      replace: ({ surveyId, deviceIds, interviewerIds }) => {
        for (let i = team.length - 1; i >= 0; i -= 1) {
          const row = team[i];
          if (row?.surveyId === surveyId && row.organizationId === org()) {
            team.splice(i, 1);
          }
        }
        for (const memberId of deviceIds) {
          team.push({ organizationId: org(), surveyId, memberId, kind: 'device' });
        }
        for (const memberId of interviewerIds) {
          team.push({ organizationId: org(), surveyId, memberId, kind: 'interviewer' });
        }
        return Promise.resolve();
      },
      surveysByDevice: () => {
        const map = new Map<string, string[]>();
        for (const row of mine(team).filter((r) => r.kind === 'device')) {
          map.set(row.memberId, [...(map.get(row.memberId) ?? []), row.surveyId]);
        }
        return Promise.resolve(map);
      },
      removeDevice: (deviceId) => {
        for (let i = team.length - 1; i >= 0; i -= 1) {
          if (team[i]?.memberId === deviceId && team[i]?.kind === 'device') {
            team.splice(i, 1);
          }
        }
        return Promise.resolve();
      },
    },
    lookup: {
      pendingPairingByCodeHash: (codeHash) => {
        const row = [...pairings.values()].find(
          (p) => p.codeHash === codeHash && !p.consumedAt && p.expiresAt > now,
        );
        return Promise.resolve(
          row ? { pairingId: row.id, organizationId: row.organizationId } : undefined,
        );
      },
      deviceByTokenHash: (tokenHash) => {
        const row = [...devices.values()].find((d) => d.tokenHash === tokenHash);
        return Promise.resolve(
          row ? { deviceId: row.id, organizationId: row.organizationId } : undefined,
        );
      },
    },
    surveys: {
      find: (ids) => Promise.resolve(mine(surveys).filter((s) => ids.includes(s.id))),
    },
    people: {
      activeInterviewers: () =>
        Promise.resolve(mine(people).map(({ id, name, email }) => ({ id, name, email }))),
      organizationName: (organizationId) =>
        Promise.resolve(organizationId === ORG_A ? 'Instituto A' : 'Instituto B'),
    },
    secrets: {
      newToken: () => {
        tokenCounter += 1;
        return `token-${String(tokenCounter)}-${'x'.repeat(40)}`;
      },
      newCode: () => {
        codeCounter += 1;
        return codes.shift() ?? String(codeCounter);
      },
      hash: (value) => `hash(${value})`,
    },
    tx: { run: (work) => work() },
    audit: {
      record: (entry) => {
        auditEntries.push({ ...entry, organizationId: org() });
        return Promise.resolve();
      },
    },
    clock: { now: () => now },
    ids: {
      next: () => {
        idCounter += 1;
        return `0193a000-0000-7000-8000-${String(idCounter).padStart(12, '0')}`;
      },
    },
    policy: { minimumAppVersion: '0.1.0', deleteSyncedAfterDays: 30 },
  };

  return {
    deps,
    devices,
    pairings,
    team,
    auditEntries,
    addSurvey: (row: SurveyRow) => surveys.push(row),
    addInterviewer: (row: PersonRow) => people.push(row),
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
};
