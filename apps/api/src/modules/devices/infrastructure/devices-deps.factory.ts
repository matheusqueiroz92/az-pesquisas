import { drizzleAuditLog } from '../../../shared/audit/drizzle-audit-log.js';
import type { Database } from '../../../shared/database/database.js';
import { createTransactionRunner } from '../../../shared/database/transaction-context.js';
import { newId } from '../../../shared/ids.js';
import { identityDirectory } from '../../identity/index.js';
import { surveyDirectory } from '../../surveys/index.js';
import type { DevicesDeps } from '../application/devices-deps.js';
import { createPgDeviceLookup, cryptoSecrets } from './adapters.js';
import {
  drizzleDeviceRepository,
  drizzlePairingRepository,
  drizzleTeamRepository,
} from './drizzle-repositories.js';

export const createDevicesDeps = (options: {
  database: Database;
  clock?: DevicesDeps['clock'];
  policy?: Partial<DevicesDeps['policy']>;
}): DevicesDeps => ({
  devices: drizzleDeviceRepository,
  pairings: drizzlePairingRepository,
  teams: drizzleTeamRepository,
  lookup: createPgDeviceLookup(options.database),
  surveys: surveyDirectory,
  people: identityDirectory,
  secrets: cryptoSecrets,
  tx: createTransactionRunner(options.database),
  audit: drizzleAuditLog,
  clock: options.clock ?? { now: () => new Date() },
  ids: { next: newId },
  policy: {
    minimumAppVersion: options.policy?.minimumAppVersion ?? '0.0.0',
    deleteSyncedAfterDays: options.policy?.deleteSyncedAfterDays ?? 30,
  },
});
