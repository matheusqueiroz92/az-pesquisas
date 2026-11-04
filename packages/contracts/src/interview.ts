import { z } from 'zod';

import { Id, IsoDateTime } from './common.js';

/**
 * An interview as the app sends it (spec 006). App -> server, so objects are
 * STRICT: an unknown field (organizationId, deviceId...) is refused, never ignored.
 * The organization and the device come from the device token (AGENTS.md rule 5).
 */

export const Sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);
export const AppVersion = z
  .string()
  .max(30)
  .regex(/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/);

export const GeoPoint = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Horizontal accuracy reported by the device, in meters. */
  accuracyM: z.number().min(0).max(100_000),
  capturedAt: IsoDateTime,
  /** Android reports mock locations; flagged for audit. */
  mocked: z.boolean(),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

/** null when the survey has GPS off; each point null when there was no fix. */
export const InterviewLocation = z
  .strictObject({ start: GeoPoint.nullable(), end: GeoPoint.nullable() })
  .nullable();

/** null when the survey has no consent text. */
export const Consent = z
  .strictObject({
    accepted: z.boolean(),
    /** SHA-256 of the consent text shown, proving which version was read. */
    textHash: Sha256Hex,
  })
  .nullable();

const answerBase = { questionId: Id };

/** single_choice and multiple_choice. */
export const ChoiceAnswer = z.strictObject({
  ...answerBase,
  kind: z.literal('choice'),
  optionIds: z.array(Id).min(1).max(200),
  /** Text of the "other" option, when selected. */
  otherText: z.string().min(1).max(500).optional(),
});

export const TextAnswer = z.strictObject({
  ...answerBase,
  kind: z.literal('text'),
  text: z.string().min(1).max(5000),
});

/** number and scale. */
export const NumberAnswer = z.strictObject({
  ...answerBase,
  kind: z.literal('number'),
  value: z.number(),
});

export const MatrixAnswer = z.strictObject({
  ...answerBase,
  kind: z.literal('matrix'),
  rows: z
    .array(z.strictObject({ rowId: Id, optionId: Id }))
    .min(1)
    .max(50),
});

/** Options in order of preference, first = most preferred. */
export const RankingAnswer = z.strictObject({
  ...answerBase,
  kind: z.literal('ranking'),
  optionIds: z.array(Id).min(1).max(200),
});

export const DateAnswer = z.strictObject({
  ...answerBase,
  kind: z.literal('date'),
  value: z.iso.date(),
});

/** photo and signature: references to entries of `media`. */
export const MediaAnswer = z.strictObject({
  ...answerBase,
  kind: z.literal('media'),
  mediaIds: z.array(Id).min(1).max(5),
});

export const Answer = z.discriminatedUnion('kind', [
  ChoiceAnswer,
  TextAnswer,
  NumberAnswer,
  MatrixAnswer,
  RankingAnswer,
  DateAnswer,
  MediaAnswer,
]);
export type Answer = z.infer<typeof Answer>;

export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

export const MediaRef = z.strictObject({
  id: Id,
  kind: z.enum(['audio', 'photo', 'signature']),
  mimeType: z
    .string()
    .max(100)
    .regex(/^[a-z]+\/[a-z0-9.+-]+$/),
  sizeBytes: z.int().min(1).max(MAX_MEDIA_BYTES),
  sha256: Sha256Hex,
});
export type MediaRef = z.infer<typeof MediaRef>;

export const Interview = z
  .strictObject({
    schemaVersion: z.literal(1),
    /** UUID v7 generated on the device (ADR-0006): resending never duplicates. */
    id: Id,
    surveyId: Id,
    versionId: Id,
    interviewerId: Id,
    appVersion: AppVersion,
    /** Device clock. The API records the offset to its own clock (from the batch sentAt). */
    startedAt: IsoDateTime,
    finishedAt: IsoDateTime,
    location: InterviewLocation,
    consent: Consent,
    answers: z.array(Answer).max(1000),
    media: z.array(MediaRef).max(50),
  })
  .superRefine((interview, ctx) => {
    if (Date.parse(interview.finishedAt) < Date.parse(interview.startedAt)) {
      ctx.addIssue({
        code: 'custom',
        path: ['finishedAt'],
        message: 'finishedAt must not be before startedAt',
      });
    }

    if (interview.consent?.accepted === false && interview.answers.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['answers'],
        message: 'a refused interview (consent declined) has no answers',
      });
    }

    const seen = new Set<string>();
    interview.answers.forEach((answer, index) => {
      if (seen.has(answer.questionId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['answers', index, 'questionId'],
          message: 'one answer per question',
        });
      }
      seen.add(answer.questionId);
    });

    const mediaIds = new Set(interview.media.map((m) => m.id));
    if (mediaIds.size !== interview.media.length) {
      ctx.addIssue({ code: 'custom', path: ['media'], message: 'repeated media id' });
    }
    interview.answers.forEach((answer, index) => {
      if (answer.kind === 'media' && !answer.mediaIds.every((id) => mediaIds.has(id))) {
        ctx.addIssue({
          code: 'custom',
          path: ['answers', index, 'mediaIds'],
          message: 'every media id must be listed in media',
        });
      }
    });
  });
export type Interview = z.infer<typeof Interview>;
