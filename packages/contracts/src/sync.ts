import { z } from 'zod';

import { Id, IsoDateTime } from './common.js';
import { AppVersion, Interview } from './interview.js';
import { QuestionnaireSnapshot } from './questionnaire.js';

/**
 * Sync protocol between the field app and the API (spec 006, Fundação técnica ›
 * Protocolo de sincronização). Requests (app -> server) are strict; responses
 * (server -> app) are tolerant, so the API can add optional fields safely.
 * The device token travels in `Authorization: Bearer`, never in a body.
 */

// ---------------------------------------------------------------- pairing

export const PairDeviceRequest = z.strictObject({
  /** 6-digit code shown in the panel, valid for 10 minutes. */
  code: z.string().regex(/^\d{6}$/),
  device: z.strictObject({
    platform: z.enum(['android', 'ios']),
    model: z.string().min(1).max(100),
    osVersion: z.string().min(1).max(50),
    appVersion: AppVersion,
  }),
});
export type PairDeviceRequest = z.infer<typeof PairDeviceRequest>;

export const PairDeviceResponse = z.object({
  deviceId: Id,
  /** Long-lived; stored in SecureStore. Only its hash exists on the server. */
  deviceToken: z.string().min(32).max(200),
  organization: z.object({ id: Id, name: z.string() }),
});
export type PairDeviceResponse = z.infer<typeof PairDeviceResponse>;

// ---------------------------------------------------------------- interviews

export const MAX_INTERVIEWS_PER_BATCH = 20;

export const SyncInterviewsRequest = z
  .strictObject({
    schemaVersion: z.literal(1),
    /** Device clock at send time; the API derives the clock offset from it. */
    sentAt: IsoDateTime,
    interviews: z.array(Interview).min(1).max(MAX_INTERVIEWS_PER_BATCH),
  })
  .superRefine((batch, ctx) => {
    const seen = new Set<string>();
    batch.interviews.forEach((interview, index) => {
      if (seen.has(interview.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['interviews', index, 'id'],
          message: 'the same interview twice in one batch',
        });
      }
      seen.add(interview.id);
    });
  });
export type SyncInterviewsRequest = z.infer<typeof SyncInterviewsRequest>;

/** Why an interview went to quarantine instead of being accepted (never discarded). */
export const SYNC_REJECTION_CODES = [
  'VERSION_UNKNOWN',
  'SURVEY_NOT_ASSIGNED',
  'INTERVIEWER_NOT_AUTHORIZED',
  'VALIDATION_FAILED',
] as const;
export type SyncRejectionCode = (typeof SYNC_REJECTION_CODES)[number];

export const SyncInterviewsResponse = z.object({
  /** Stored (or already stored before): the app may mark them as synced. */
  accepted: z.array(Id),
  /** Kept in quarantine on the server; the app keeps them flagged, not deleted. */
  rejected: z.array(z.object({ id: Id, code: z.enum(SYNC_REJECTION_CODES) })),
});
export type SyncInterviewsResponse = z.infer<typeof SyncInterviewsResponse>;

// ---------------------------------------------------------------- pull

export const SyncPullRequest = z.strictObject({
  schemaVersion: z.literal(1),
  known: z.strictObject({
    /** Versions the device already has; the API sends only what changed. */
    surveys: z.array(z.strictObject({ surveyId: Id, versionId: Id })).max(200),
    interviewersRevision: z.string().max(100).nullable(),
  }),
});
export type SyncPullRequest = z.infer<typeof SyncPullRequest>;

/** Lets the app check a PIN offline. The PIN itself never leaves the server. */
export const PinCredential = z.object({
  algorithm: z.literal('scrypt'),
  N: z.int().min(1024),
  r: z.int().min(1),
  p: z.int().min(1),
  salt: z.base64(),
  hash: z.base64(),
});
export type PinCredential = z.infer<typeof PinCredential>;

export const SyncPullResponse = z.object({
  serverTime: IsoDateTime,
  surveys: z.array(
    z.object({
      surveyId: Id,
      status: z.enum(['active', 'closed']),
      /** Present only when the device does not have this version yet. */
      snapshot: QuestionnaireSnapshot.optional(),
    }),
  ),
  /** No longer assigned to this device. */
  removedSurveyIds: z.array(Id),
  /** Present only when the list changed since `interviewersRevision`. */
  interviewers: z
    .object({
      revision: z.string().max(100),
      items: z.array(z.object({ id: Id, name: z.string(), pin: PinCredential })),
    })
    .optional(),
});
export type SyncPullResponse = z.infer<typeof SyncPullResponse>;

// ---------------------------------------------------------------- heartbeat

export const HeartbeatRequest = z.strictObject({
  appVersion: AppVersion,
  batteryLevel: z.number().min(0).max(1).nullable(),
  pendingInterviews: z.int().min(0),
  pendingMediaBytes: z.int().min(0),
  storageFreeBytes: z.int().min(0).nullable(),
  /** Short technical message, no personal data. */
  lastSyncError: z.string().max(300).nullable(),
});
export type HeartbeatRequest = z.infer<typeof HeartbeatRequest>;

export const HeartbeatResponse = z.object({
  serverTime: IsoDateTime,
  /** Older apps are told to update before syncing again. */
  minimumAppVersion: AppVersion,
  policy: z.object({
    /** Synced interviews are deleted from the device after this many days. */
    deleteSyncedAfterDays: z.int().min(1).max(365),
  }),
});
export type HeartbeatResponse = z.infer<typeof HeartbeatResponse>;
