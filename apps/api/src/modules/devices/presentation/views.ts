import type { DeviceView } from '@az-pesquisas/contracts';

import type { DeviceDetails } from '../application/devices.js';

export const toDeviceView = (d: DeviceDetails): DeviceView => ({
  id: d.id,
  nickname: d.nickname,
  platform: d.platform,
  model: d.model,
  osVersion: d.osVersion,
  appVersion: d.appVersion,
  status: d.revokedAt ? 'revoked' : 'active',
  pairedAt: d.pairedAt.toISOString(),
  lastSeenAt: d.lastSeenAt.toISOString(),
  revokedAt: d.revokedAt?.toISOString() ?? null,
  surveys: d.surveys,
});
