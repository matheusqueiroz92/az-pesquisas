import type { SurveyType } from '@az-pesquisas/contracts';

import { parseBrl } from './format';

/** Reads a form field as trimmed text ('' when absent). */
export type FieldReader = (name: string) => string;

const orNull = (value: string): string | null => (value === '' ? null : value);

/** A number typed in an <input type="number">; garbage is sent as is, for the API to point at. */
const numberOrNull = (value: string): number | string | null => {
  if (value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
};

export type SurveyBodyResult =
  { ok: true; body: Record<string, unknown> } | { ok: false; field: string };

/**
 * The body of POST/PATCH /v1/surveys from the panel form. The form always sends
 * every field (settings and tse replace their whole group, spec 013).
 */
export const surveyBodyFrom = (
  read: FieldReader,
  state: { type: SurveyType; tseRegistered: boolean; municipalityCodes: readonly number[] },
): SurveyBodyResult => {
  let tse: Record<string, unknown> | null = null;
  if (state.type === 'electoral' && state.tseRegistered) {
    const contractValueCents = parseBrl(read('contractValue'));
    if (contractValueCents === undefined) {
      return { ok: false, field: 'tse.contractValueCents' };
    }
    tse = {
      registrationNumber: orNull(read('registrationNumber')),
      statisticianName: orNull(read('statisticianName')),
      statisticianConre: orNull(read('statisticianConre')),
      contractorName: orNull(read('contractorName')),
      contractValueCents,
    };
  }
  const minutes = numberOrNull(read('minDurationMin'));
  return {
    ok: true,
    body: {
      title: read('title'),
      type: state.type,
      clientId: orNull(read('clientId')),
      municipalityCodes: [...state.municipalityCodes],
      fieldStart: orNull(read('fieldStart')),
      fieldEnd: orNull(read('fieldEnd')),
      targetInterviews: numberOrNull(read('targetInterviews')),
      settings: {
        gps: read('gps'),
        audio: read('audio'),
        minDurationSec: typeof minutes === 'number' ? Math.round(minutes * 60) : (minutes ?? 0),
        consentText: orNull(read('consentText')),
      },
      tse,
    },
  };
};

/** Reais as the form shows them: 1250000 cents → "12.500,00". */
export const centsToInput = (cents: number | null): string =>
  cents === null
    ? ''
    : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
        cents / 100,
      );

/** A text field of a submitted form, trimmed ('' when absent or a file). */
export const formText = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
};
