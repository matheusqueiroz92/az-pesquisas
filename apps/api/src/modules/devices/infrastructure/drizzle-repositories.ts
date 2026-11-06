import { count, desc, eq, isNull } from 'drizzle-orm';

import { currentTx } from '../../../shared/database/transaction-context.js';
import { currentOrganizationId } from '../../../shared/tenancy/tenant-context.js';
import { Device } from '../domain/device.js';
import { Pairing } from '../domain/pairing.js';
import type {
  DeviceRepository,
  PairingRepository,
  TeamRepository,
} from '../domain/repositories.js';
import { devicePairings, devices, surveyDevices, surveyInterviewers } from './schema.js';

// Every query runs in the tenant transaction (RLS on).

export const drizzleDeviceRepository: DeviceRepository = {
  findById: async (id, options) => {
    const query = currentTx().select().from(devices).where(eq(devices.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? Device.fromSnapshot(row) : undefined;
  },
  list: async () =>
    (await currentTx().select().from(devices).orderBy(desc(devices.pairedAt))).map((row) =>
      Device.fromSnapshot(row),
    ),
  count: async () => {
    const [row] = await currentTx().select({ total: count() }).from(devices);
    return row?.total ?? 0;
  },
  add: async (device) => {
    await currentTx().insert(devices).values(device.toSnapshot());
  },
  save: async (device) => {
    const { id, organizationId: _org, tokenHash: _token, ...changes } = device.toSnapshot();
    await currentTx().update(devices).set(changes).where(eq(devices.id, id));
  },
};

export const drizzlePairingRepository: PairingRepository = {
  findById: async (id, options) => {
    const query = currentTx().select().from(devicePairings).where(eq(devicePairings.id, id));
    const [row] = options?.forUpdate ? await query.for('update') : await query;
    return row ? Pairing.fromSnapshot(row) : undefined;
  },
  add: async (pairing) => {
    // A clash with the partial unique index (same pending digits, any organization)
    // must not abort the transaction: ON CONFLICT DO NOTHING and look at the count.
    const inserted = await currentTx()
      .insert(devicePairings)
      .values(pairing.toSnapshot())
      .onConflictDoNothing({
        target: devicePairings.codeHash,
        where: isNull(devicePairings.consumedAt),
      })
      .returning({ id: devicePairings.id });
    return inserted.length === 1;
  },
  save: async (pairing) => {
    const { id, deviceId, consumedAt } = pairing.toSnapshot();
    await currentTx()
      .update(devicePairings)
      .set({ deviceId, consumedAt })
      .where(eq(devicePairings.id, id));
  },
};

export const drizzleTeamRepository: TeamRepository = {
  of: async (surveyId) => {
    const [deviceRows, interviewerRows] = await Promise.all([
      currentTx()
        .select({ id: surveyDevices.deviceId })
        .from(surveyDevices)
        .where(eq(surveyDevices.surveyId, surveyId)),
      currentTx()
        .select({ id: surveyInterviewers.userId })
        .from(surveyInterviewers)
        .where(eq(surveyInterviewers.surveyId, surveyId)),
    ]);
    return {
      deviceIds: deviceRows.map((r) => r.id),
      interviewerIds: interviewerRows.map((r) => r.id),
    };
  },
  replace: async ({ surveyId, deviceIds, interviewerIds, by, now }) => {
    const tx = currentTx();
    await tx.delete(surveyDevices).where(eq(surveyDevices.surveyId, surveyId));
    await tx.delete(surveyInterviewers).where(eq(surveyInterviewers.surveyId, surveyId));
    const organizationId = currentOrganizationId();
    if (deviceIds.length > 0) {
      await tx.insert(surveyDevices).values(
        deviceIds.map((deviceId) => ({
          organizationId,
          surveyId,
          deviceId,
          assignedAt: now,
          assignedBy: by,
        })),
      );
    }
    if (interviewerIds.length > 0) {
      await tx.insert(surveyInterviewers).values(
        interviewerIds.map((userId) => ({
          organizationId,
          surveyId,
          userId,
          assignedAt: now,
          assignedBy: by,
        })),
      );
    }
  },
  surveysByDevice: async () => {
    const rows = await currentTx()
      .select({ deviceId: surveyDevices.deviceId, surveyId: surveyDevices.surveyId })
      .from(surveyDevices);
    const map = new Map<string, string[]>();
    for (const row of rows) {
      map.set(row.deviceId, [...(map.get(row.deviceId) ?? []), row.surveyId]);
    }
    return map;
  },
  removeDevice: async (deviceId) => {
    await currentTx().delete(surveyDevices).where(eq(surveyDevices.deviceId, deviceId));
  },
};
