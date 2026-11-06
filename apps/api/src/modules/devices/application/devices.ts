import { can, PAIRING_TTL_MS } from '@az-pesquisas/contracts';
import type { DevicePlatform, HeartbeatRequest, SurveyStatus } from '@az-pesquisas/contracts';
import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { runWithTenant } from '../../../shared/tenancy/tenant-context.js';
import { Device } from '../domain/device.js';
import type { DeviceSnapshot } from '../domain/device.js';
import { Pairing } from '../domain/pairing.js';
import type { PairingStatus } from '../domain/pairing.js';
import type { DevicesDeps } from './devices-deps.js';
import type { Actor } from './ports.js';

export interface DeviceDetails extends Omit<DeviceSnapshot, 'tokenHash' | 'organizationId'> {
  readonly surveys: { id: string; title: string; status: SurveyStatus }[];
}

/** Runs as the actor's organization, in one transaction, with `devices.manage`. */
export const asDeviceManager = <T, E>(
  deps: DevicesDeps,
  actor: Actor,
  work: () => Promise<Result<T, E>>,
): Promise<Result<T, E | 'FORBIDDEN'>> => {
  if (!can(actor.role, 'devices.manage')) {
    return Promise.resolve(err('FORBIDDEN'));
  }
  return runWithTenant(actor.organizationId, () => deps.tx.run(work));
};

const detailsOf = async (
  deps: DevicesDeps,
  devices: readonly Device[],
): Promise<DeviceDetails[]> => {
  const byDevice = await deps.teams.surveysByDevice();
  const surveyIds = [...new Set([...byDevice.values()].flat())];
  const refs = new Map((await deps.surveys.find(surveyIds)).map((s) => [s.id, s]));
  return devices.map((device) => {
    const { tokenHash: _hash, organizationId: _org, ...rest } = device.toSnapshot();
    const surveys = (byDevice.get(device.id) ?? []).flatMap((id) => {
      const ref = refs.get(id);
      return ref ? [ref] : [];
    });
    return { ...rest, surveys };
  });
};

const MAX_CODE_ATTEMPTS = 5;

/** A one-time 6-digit code, valid for 10 minutes (spec 016 rule 2). */
export const createPairing = (
  deps: DevicesDeps,
  actor: Actor,
): Promise<Result<{ id: string; code: string; expiresAt: Date }, 'FORBIDDEN'>> =>
  asDeviceManager(deps, actor, async () => {
    const now = deps.clock.now();
    for (let attempt = 1; ; attempt += 1) {
      const code = deps.secrets.newCode();
      const pairing = Pairing.create({
        id: deps.ids.next(),
        organizationId: actor.organizationId,
        codeHash: deps.secrets.hash(code),
        createdBy: actor.userId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + PAIRING_TTL_MS),
      });
      // A pending code of anyone (any organization) with the same digits: draw again.
      if (await deps.pairings.add(pairing)) {
        await deps.audit.record({
          action: 'device.pairing_created',
          actorUserId: actor.userId,
          entity: 'device_pairing',
          entityId: pairing.id,
        });
        return ok({ id: pairing.id, code, expiresAt: pairing.toSnapshot().expiresAt });
      }
      if (attempt >= MAX_CODE_ATTEMPTS) {
        throw new Error('Could not draw a free pairing code');
      }
    }
  });

export const getPairing = (
  deps: DevicesDeps,
  actor: Actor,
  pairingId: string,
): Promise<
  Result<
    { id: string; status: PairingStatus; expiresAt: Date; device: DeviceDetails | null },
    'FORBIDDEN' | 'PAIRING_NOT_FOUND'
  >
> =>
  asDeviceManager(deps, actor, async () => {
    const pairing = await deps.pairings.findById(pairingId);
    if (!pairing) {
      return err('PAIRING_NOT_FOUND');
    }
    const device = pairing.deviceId ? await deps.devices.findById(pairing.deviceId) : undefined;
    const [details] = device ? await detailsOf(deps, [device]) : [];
    return ok({
      id: pairing.id,
      status: pairing.status(deps.clock.now()),
      expiresAt: pairing.toSnapshot().expiresAt,
      device: details ?? null,
    });
  });

/**
 * The app redeems a code (spec 016 rule 3). Public: the organization comes from
 * the code, found by its hash across organizations.
 */
export const pairDevice = async (
  deps: DevicesDeps,
  input: {
    code: string;
    device: { platform: DevicePlatform; model: string; osVersion: string; appVersion: string };
  },
): Promise<
  Result<
    { deviceId: string; deviceToken: string; organization: { id: string; name: string } },
    'PAIRING_CODE_INVALID'
  >
> => {
  const found = await deps.lookup.pendingPairingByCodeHash(deps.secrets.hash(input.code));
  if (!found) {
    return err('PAIRING_CODE_INVALID');
  }
  return runWithTenant(found.organizationId, () =>
    deps.tx.run(async () => {
      const pairing = await deps.pairings.findById(found.pairingId, { forUpdate: true });
      if (!pairing) {
        return err('PAIRING_CODE_INVALID' as const);
      }
      const now = deps.clock.now();
      const deviceId = deps.ids.next();
      const consumed = pairing.consume({ deviceId, now });
      if (!consumed.ok) {
        return consumed;
      }
      const token = deps.secrets.newToken();
      const device = Device.pair({
        id: deviceId,
        organizationId: found.organizationId,
        nickname: `Aparelho ${String((await deps.devices.count()) + 1)}`,
        ...input.device,
        tokenHash: deps.secrets.hash(token),
        pairedAt: now,
        pairedBy: pairing.toSnapshot().createdBy,
      });
      await deps.devices.add(device);
      await deps.pairings.save(pairing);
      await deps.audit.record({
        action: 'device.paired',
        actorUserId: null,
        entity: 'device',
        entityId: device.id,
        metadata: { pairingId: pairing.id, platform: input.device.platform },
      });
      const name = (await deps.people.organizationName(found.organizationId)) ?? '';
      return ok({ deviceId, deviceToken: token, organization: { id: found.organizationId, name } });
    }),
  );
};

export const listDevices = (
  deps: DevicesDeps,
  actor: Actor,
): Promise<Result<DeviceDetails[], 'FORBIDDEN'>> =>
  asDeviceManager(deps, actor, async () => ok(await detailsOf(deps, await deps.devices.list())));

export const renameDevice = (
  deps: DevicesDeps,
  actor: Actor,
  deviceId: string,
  nickname: string,
): Promise<Result<DeviceDetails, 'FORBIDDEN' | 'DEVICE_NOT_FOUND' | 'DEVICE_REVOKED'>> =>
  asDeviceManager(deps, actor, async () => {
    const device = await deps.devices.findById(deviceId, { forUpdate: true });
    if (!device) {
      return err('DEVICE_NOT_FOUND');
    }
    const renamed = device.rename(nickname);
    if (!renamed.ok) {
      return renamed;
    }
    if (renamed.value) {
      await deps.devices.save(device);
      await deps.audit.record({
        action: 'device.renamed',
        actorUserId: actor.userId,
        entity: 'device',
        entityId: device.id,
      });
    }
    const [details] = await detailsOf(deps, [device]);
    return details ? ok(details) : err('DEVICE_NOT_FOUND');
  });

/** The token stops working now; the device leaves every survey team (rule 8). */
export const revokeDevice = (
  deps: DevicesDeps,
  actor: Actor,
  deviceId: string,
): Promise<Result<DeviceDetails, 'FORBIDDEN' | 'DEVICE_NOT_FOUND' | 'DEVICE_REVOKED'>> =>
  asDeviceManager(deps, actor, async () => {
    const device = await deps.devices.findById(deviceId, { forUpdate: true });
    if (!device) {
      return err('DEVICE_NOT_FOUND');
    }
    const revoked = device.revoke({ now: deps.clock.now(), by: actor.userId });
    if (!revoked.ok) {
      return revoked;
    }
    await deps.devices.save(device);
    await deps.teams.removeDevice(device.id);
    await deps.audit.record({
      action: 'device.revoked',
      actorUserId: actor.userId,
      entity: 'device',
      entityId: device.id,
    });
    const [details] = await detailsOf(deps, [device]);
    return details ? ok(details) : err('DEVICE_NOT_FOUND');
  });

/** The app checks in with its token (spec 016 rule 9; contract of spec 006). */
export const heartbeat = async (
  deps: DevicesDeps,
  token: string,
  input: HeartbeatRequest,
): Promise<
  Result<
    {
      serverTime: Date;
      minimumAppVersion: string;
      policy: { deleteSyncedAfterDays: number };
    },
    'DEVICE_TOKEN_INVALID'
  >
> => {
  const found = await deps.lookup.deviceByTokenHash(deps.secrets.hash(token));
  if (!found) {
    return err('DEVICE_TOKEN_INVALID');
  }
  return runWithTenant(found.organizationId, () =>
    deps.tx.run(async () => {
      const device = await deps.devices.findById(found.deviceId, { forUpdate: true });
      if (!device?.isActive) {
        return err('DEVICE_TOKEN_INVALID' as const);
      }
      const now = deps.clock.now();
      device.touch({ now, appVersion: input.appVersion });
      await deps.devices.save(device);
      return ok({
        serverTime: now,
        minimumAppVersion: deps.policy.minimumAppVersion,
        policy: { deleteSyncedAfterDays: deps.policy.deleteSyncedAfterDays },
      });
    }),
  );
};
