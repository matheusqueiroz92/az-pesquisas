import { createHash, randomBytes, randomInt } from 'node:crypto';

import type { Database } from '../../../shared/database/database.js';
import type { CrossTenantLookup, Secrets } from '../application/ports.js';

export const cryptoSecrets: Secrets = {
  newToken: () => randomBytes(32).toString('base64url'),
  newCode: () => String(randomInt(0, 1_000_000)).padStart(6, '0'),
  hash: (value) => createHash('sha256').update(value).digest('hex'),
};

/** Calls the SECURITY DEFINER functions of migration 0012 (ids only). */
export const createPgDeviceLookup = (database: Database): CrossTenantLookup => ({
  pendingPairingByCodeHash: (codeHash) =>
    database.withoutTenant(async (client) => {
      const { rows } = await client.query<{ pairing_id: string; organization_id: string }>(
        'SELECT pairing_id, organization_id FROM devices_find_pending_pairing($1)',
        [codeHash],
      );
      const row = rows[0];
      return row && { pairingId: row.pairing_id, organizationId: row.organization_id };
    }),
  deviceByTokenHash: (tokenHash) =>
    database.withoutTenant(async (client) => {
      const { rows } = await client.query<{ device_id: string; organization_id: string }>(
        'SELECT device_id, organization_id FROM devices_find_by_token_hash($1)',
        [tokenHash],
      );
      const row = rows[0];
      return row && { deviceId: row.device_id, organizationId: row.organization_id };
    }),
});
