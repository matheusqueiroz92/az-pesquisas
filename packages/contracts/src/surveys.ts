import { z } from 'zod';

import { Email, Id, IsoDateTime } from './common.js';
import { isBahiaMunicipality } from './municipalities-ba.js';

// ---------------------------------------------------------------- shared pieces

/** Trims; empty or blank becomes null. */
const blankToNull = (value: string | null): string | null => {
  const text = value?.trim() ?? '';
  return text.length > 0 ? text : null;
};

/** Optional free text: trimmed; empty or blank becomes null. */
const nullableText = (max: number) =>
  z.union([z.string(), z.null()]).transform(blankToNull).pipe(z.string().max(max).nullable());

const allSame = (digits: string) => /^(\d)\1*$/.test(digits);

const checkDigit = (digits: string, weights: readonly number[]): number => {
  const sum = weights.reduce((total, weight, i) => total + Number(digits[i]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
};

const isValidCpf = (cpf: string): boolean =>
  checkDigit(cpf, [10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cpf[9]) &&
  checkDigit(cpf, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cpf[10]);

const isValidCnpj = (cnpj: string): boolean =>
  checkDigit(cnpj, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
  checkDigit(cnpj, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);

/** CPF (11 digits) or CNPJ (14 digits), digits only, check digits verified. */
export const isValidTaxId = (digits: string): boolean => {
  if (!/^\d+$/.test(digits) || allSame(digits)) {
    return false;
  }
  if (digits.length === 11) {
    return isValidCpf(digits);
  }
  return digits.length === 14 && isValidCnpj(digits);
};

/** CPF or CNPJ as typed (with or without mask); output has digits only. */
export const TaxId = z
  .string()
  .trim()
  .regex(/^[\d.\-/\s]+$/)
  .transform((value) => value.replace(/\D/g, ''))
  .refine(isValidTaxId, { message: 'Invalid CPF or CNPJ' });

const nullableTaxId = z.union([z.string(), z.null()]).transform(blankToNull).pipe(TaxId.nullable());

const nullableEmail = z.union([z.string(), z.null()]).transform(blankToNull).pipe(Email.nullable());

const nullablePhone = nullableText(30).refine(
  (value) => value === null || /^[0-9()+\-\s]{8,30}$/.test(value),
  { message: 'Invalid phone' },
);

const ClientName = z.string().trim().min(2).max(120);

// ---------------------------------------------------------------- clients

export const CreateClientRequest = z.strictObject({
  name: ClientName,
  document: nullableTaxId.default(null),
  contactName: nullableText(120).default(null),
  contactEmail: nullableEmail.default(null),
  contactPhone: nullablePhone.default(null),
});
export type CreateClientRequest = z.infer<typeof CreateClientRequest>;

export const UpdateClientRequest = z
  .strictObject({
    name: ClientName.optional(),
    document: nullableTaxId.optional(),
    contactName: nullableText(120).optional(),
    contactEmail: nullableEmail.optional(),
    contactPhone: nullablePhone.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateClientRequest = z.infer<typeof UpdateClientRequest>;

export const ClientView = z.object({
  id: Id,
  name: z.string(),
  document: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  surveyCount: z.int().min(0),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ClientView = z.infer<typeof ClientView>;

export const ClientListResponse = z.object({ items: z.array(ClientView) });
export type ClientListResponse = z.infer<typeof ClientListResponse>;

// ---------------------------------------------------------------- surveys

export const SURVEY_TYPES = [
  'satisfaction',
  'market',
  'public_opinion',
  'municipal_evaluation',
  'electoral',
] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const SURVEY_STATUSES = ['draft', 'in_field', 'closed', 'archived'] as const;
export type SurveyStatus = (typeof SURVEY_STATUSES)[number];

export const GPS_MODES = ['off', 'optional', 'required'] as const;
export type GpsMode = (typeof GPS_MODES)[number];

export const AUDIO_MODES = ['off', 'on'] as const;
export type AudioMode = (typeof AUDIO_MODES)[number];

export const MAX_TARGET_INTERVIEWS = 1_000_000;
/** R$ 1 bilhão, in cents: far above any real contract, well inside a safe integer. */
export const MAX_CONTRACT_VALUE_CENTS = 100_000_000_000;

/** PesqEle registration number, e.g. BA-01234/2026. */
export const TseRegistrationNumber = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}-\d{5}\/\d{4}$/);

const nullableTseNumber = z
  .union([z.string(), z.null()])
  .transform(blankToNull)
  .pipe(TseRegistrationNumber.nullable());

/**
 * Data of an electoral survey registered at the TSE (printed on the technical
 * sheet). Every field may stay empty while the survey is a draft (spec 013).
 */
export const SurveyTse = z.strictObject({
  registrationNumber: nullableTseNumber.default(null),
  statisticianName: nullableText(120).default(null),
  statisticianConre: nullableText(40).default(null),
  contractorName: nullableText(160).default(null),
  contractValueCents: z.int().min(0).max(MAX_CONTRACT_VALUE_CENTS).nullable().default(null),
});
export type SurveyTse = z.infer<typeof SurveyTse>;

/** Same shape as the snapshot's SurveySettings (spec 006); copied there on publish. */
export const SurveySettingsInput = z.strictObject({
  gps: z.enum(GPS_MODES).default('optional'),
  audio: z.enum(AUDIO_MODES).default('off'),
  minDurationSec: z.int().min(0).max(7200).default(0),
  consentText: nullableText(2000).default(null),
});
export type SurveySettingsInput = z.infer<typeof SurveySettingsInput>;

const SurveyTitle = z.string().trim().min(3).max(160);
const IsoDate = z.iso.date();

const MunicipalityCodes = z
  .array(z.int().refine(isBahiaMunicipality, { message: 'Not a municipality of Bahia' }))
  .max(417)
  .refine((codes) => new Set(codes).size === codes.length, {
    message: 'Repeated municipality',
  });

interface CrossFields {
  type?: SurveyType;
  tse?: SurveyTse | null;
  fieldStart?: string | null;
  fieldEnd?: string | null;
}

const checkCrossFields = (body: CrossFields, ctx: z.RefinementCtx): void => {
  if (body.type !== undefined && body.type !== 'electoral' && body.tse) {
    ctx.addIssue({
      code: 'custom',
      path: ['tse'],
      message: 'TSE data is only for electoral surveys',
    });
  }
  if (body.fieldStart && body.fieldEnd && body.fieldEnd < body.fieldStart) {
    ctx.addIssue({
      code: 'custom',
      path: ['fieldEnd'],
      message: 'Field end is before field start',
    });
  }
};

export const CreateSurveyRequest = z
  .strictObject({
    title: SurveyTitle,
    type: z.enum(SURVEY_TYPES),
    clientId: Id.nullable().default(null),
    municipalityCodes: MunicipalityCodes.default([]),
    fieldStart: IsoDate.nullable().default(null),
    fieldEnd: IsoDate.nullable().default(null),
    targetInterviews: z.int().min(1).max(MAX_TARGET_INTERVIEWS).nullable().default(null),
    settings: SurveySettingsInput.prefault({}),
    /** null: not registered at the TSE. An object (even empty): registered. */
    tse: SurveyTse.nullable().default(null),
  })
  .superRefine(checkCrossFields);
export type CreateSurveyRequest = z.infer<typeof CreateSurveyRequest>;

/** Partial update; `settings` and `tse`, when sent, replace the whole group. */
export const UpdateSurveyRequest = z
  .strictObject({
    title: SurveyTitle.optional(),
    type: z.enum(SURVEY_TYPES).optional(),
    clientId: Id.nullable().optional(),
    municipalityCodes: MunicipalityCodes.optional(),
    fieldStart: IsoDate.nullable().optional(),
    fieldEnd: IsoDate.nullable().optional(),
    targetInterviews: z.int().min(1).max(MAX_TARGET_INTERVIEWS).nullable().optional(),
    settings: SurveySettingsInput.optional(),
    tse: SurveyTse.nullable().optional(),
  })
  .superRefine(checkCrossFields)
  .refine((body) => Object.keys(body).length > 0, { message: 'Nothing to update' });
export type UpdateSurveyRequest = z.infer<typeof UpdateSurveyRequest>;

export const SurveySettingsView = z.object({
  gps: z.enum(GPS_MODES),
  audio: z.enum(AUDIO_MODES),
  minDurationSec: z.int(),
  consentText: z.string().nullable(),
});

export const SurveyTseView = z.object({
  registrationNumber: z.string().nullable(),
  statisticianName: z.string().nullable(),
  statisticianConre: z.string().nullable(),
  contractorName: z.string().nullable(),
  contractValueCents: z.int().nullable(),
});

export const SurveyView = z.object({
  id: Id,
  title: z.string(),
  type: z.enum(SURVEY_TYPES),
  status: z.enum(SURVEY_STATUSES),
  clientId: Id.nullable(),
  clientName: z.string().nullable(),
  municipalityCodes: z.array(z.int()),
  fieldStart: IsoDate.nullable(),
  fieldEnd: IsoDate.nullable(),
  targetInterviews: z.int().nullable(),
  settings: SurveySettingsView,
  tse: SurveyTseView.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type SurveyView = z.infer<typeof SurveyView>;

export const SurveySummary = SurveyView.pick({
  id: true,
  title: true,
  type: true,
  status: true,
  clientId: true,
  clientName: true,
  fieldStart: true,
  fieldEnd: true,
  targetInterviews: true,
  updatedAt: true,
}).extend({ municipalityCount: z.int().min(0) });
export type SurveySummary = z.infer<typeof SurveySummary>;

export const SurveyListResponse = z.object({ items: z.array(SurveySummary) });
export type SurveyListResponse = z.infer<typeof SurveyListResponse>;
