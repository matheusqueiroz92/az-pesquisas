import { z } from 'zod';

import { Id, IsoDateTime } from './common.js';
import { SURVEY_STATUSES } from './surveys.js';

/** Devices of the organization and the team of each survey (spec 016). */

// Pairing request/response and heartbeat are the app contracts of spec 006
// (sync.ts): the device token travels in `Authorization: Bearer`.

export const DEVICE_PLATFORMS = ['android', 'ios'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

/** A pairing code lasts 10 minutes (spec 016 rule 2). */
export const PAIRING_TTL_MS = 10 * 60 * 1000;

export const PairingCreated = z.object({
  id: Id,
  /** Shown once on the panel; only its hash is stored. */
  code: z.string().regex(/^\d{6}$/),
  expiresAt: IsoDateTime,
});
export type PairingCreated = z.infer<typeof PairingCreated>;

const SurveyRef = z.object({ id: Id, title: z.string(), status: z.enum(SURVEY_STATUSES) });

export const DeviceView = z.object({
  id: Id,
  nickname: z.string(),
  platform: z.enum(DEVICE_PLATFORMS),
  model: z.string(),
  osVersion: z.string(),
  appVersion: z.string(),
  status: z.enum(['active', 'revoked']),
  pairedAt: IsoDateTime,
  lastSeenAt: IsoDateTime,
  revokedAt: IsoDateTime.nullable(),
  surveys: z.array(SurveyRef),
});
export type DeviceView = z.infer<typeof DeviceView>;

export const DeviceListResponse = z.object({ items: z.array(DeviceView) });
export type DeviceListResponse = z.infer<typeof DeviceListResponse>;

export const PairingStatus = z.object({
  id: Id,
  status: z.enum(['pending', 'paired', 'expired']),
  expiresAt: IsoDateTime,
  device: DeviceView.nullable(),
});
export type PairingStatus = z.infer<typeof PairingStatus>;

export const UpdateDeviceRequest = z.strictObject({
  nickname: z.string().trim().min(2).max(60),
});
export type UpdateDeviceRequest = z.infer<typeof UpdateDeviceRequest>;

export const SurveyTeamView = z.object({
  devices: z.array(
    z.object({ id: Id, nickname: z.string(), model: z.string(), assigned: z.boolean() }),
  ),
  interviewers: z.array(
    z.object({ id: Id, name: z.string(), email: z.string(), assigned: z.boolean() }),
  ),
});
export type SurveyTeamView = z.infer<typeof SurveyTeamView>;

const UniqueIds = (max: number) =>
  z
    .array(Id)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Repeated id' });

export const UpdateSurveyTeamRequest = z.strictObject({
  deviceIds: UniqueIds(500),
  interviewerIds: UniqueIds(1000),
});
export type UpdateSurveyTeamRequest = z.infer<typeof UpdateSurveyTeamRequest>;
