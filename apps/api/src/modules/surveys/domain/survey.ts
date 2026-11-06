import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';
import {
  isMunicipality,
  MAX_SURVEY_MUNICIPALITIES,
  MAX_TARGET_INTERVIEWS,
} from '@az-pesquisas/contracts';
import type {
  SurveySettingsInput,
  SurveyStatus,
  SurveyTse,
  SurveyType,
} from '@az-pesquisas/contracts';

export const MAX_TITLE_LENGTH = 160;

export interface SurveyFields {
  readonly title: string;
  readonly type: SurveyType;
  /** null: the organization's own survey. */
  readonly clientId: string | null;
  /** IBGE codes of municipalities (any state). */
  readonly municipalityCodes: readonly number[];
  /** YYYY-MM-DD */
  readonly fieldStart: string | null;
  readonly fieldEnd: string | null;
  readonly targetInterviews: number | null;
  readonly settings: SurveySettingsInput;
  /** null: not registered at the TSE (always null unless the type is electoral). */
  readonly tse: SurveyTse | null;
}

export type SurveyField = keyof SurveyFields;

/** Fields to change; absent or undefined means "keep". */
export type SurveyChanges = { readonly [K in SurveyField]?: SurveyFields[K] | undefined };

export interface SurveySnapshot extends SurveyFields {
  readonly id: string;
  readonly organizationId: string;
  readonly status: SurveyStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type SurveyStateError = 'SURVEY_NOT_EDITABLE';

const FIELDS: readonly SurveyField[] = [
  'title',
  'type',
  'clientId',
  'municipalityCodes',
  'fieldStart',
  'fieldEnd',
  'targetInterviews',
  'settings',
  'tse',
];

// Defensive checks: the HTTP layer validates with Zod, but the aggregate never
// holds an invalid survey, whoever calls it (duplication, future imports).
const normalize = (fields: SurveyFields): SurveyFields => {
  const title = fields.title.trim();
  if (title.length < 3 || title.length > MAX_TITLE_LENGTH) {
    throw new TypeError('Invalid survey title');
  }
  const codes = fields.municipalityCodes;
  if (
    codes.length > MAX_SURVEY_MUNICIPALITIES ||
    !codes.every(isMunicipality) ||
    new Set(codes).size !== codes.length
  ) {
    throw new TypeError('Invalid municipalities');
  }
  if (fields.fieldStart && fields.fieldEnd && fields.fieldEnd < fields.fieldStart) {
    throw new TypeError('Field end is before field start');
  }
  const target = fields.targetInterviews;
  if (
    target !== null &&
    (!Number.isInteger(target) || target < 1 || target > MAX_TARGET_INTERVIEWS)
  ) {
    throw new TypeError('Invalid target');
  }
  // Field by field: callers may pass a whole snapshot, whose extra keys must not leak.
  return {
    title,
    type: fields.type,
    clientId: fields.clientId,
    municipalityCodes: [...codes],
    fieldStart: fields.fieldStart,
    fieldEnd: fields.fieldEnd,
    targetInterviews: target,
    settings: { ...fields.settings },
    // TSE data belongs only to electoral surveys (spec 013 rule 6).
    tse: fields.type === 'electoral' && fields.tse ? { ...fields.tse } : null,
  };
};

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export class Survey {
  private constructor(private state: SurveySnapshot) {}

  static create(input: {
    id: string;
    organizationId: string;
    now: Date;
    fields: SurveyFields;
  }): Survey {
    return new Survey({
      id: input.id,
      organizationId: input.organizationId,
      status: 'draft',
      ...normalize(input.fields),
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static fromSnapshot(snapshot: SurveySnapshot): Survey {
    return new Survey({ ...snapshot });
  }

  toSnapshot(): SurveySnapshot {
    return { ...this.state };
  }

  get id(): string {
    return this.state.id;
  }

  get title(): string {
    return this.state.title;
  }

  get status(): SurveyStatus {
    return this.state.status;
  }

  get clientId(): string | null {
    return this.state.clientId;
  }

  /** Only a draft is edited here; what changes after publication is spec 015. */
  update(changes: SurveyChanges, now: Date): Result<{ changed: SurveyField[] }, SurveyStateError> {
    if (this.state.status !== 'draft') {
      return err('SURVEY_NOT_EDITABLE');
    }
    // Not `??`: null is a real value here (e.g. clientId: null = own survey).
    const keep = <K extends SurveyField>(field: K): SurveyFields[K] =>
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      changes[field] === undefined ? this.state[field] : changes[field];
    const next = normalize({
      title: keep('title'),
      type: keep('type'),
      clientId: keep('clientId'),
      municipalityCodes: keep('municipalityCodes'),
      fieldStart: keep('fieldStart'),
      fieldEnd: keep('fieldEnd'),
      targetInterviews: keep('targetInterviews'),
      settings: keep('settings'),
      tse: keep('tse'),
    });
    const changed = FIELDS.filter((field) => !sameValue(next[field], this.state[field]));
    if (changed.length > 0) {
      this.state = { ...this.state, ...next, updatedAt: now };
    }
    return ok({ changed });
  }

  archive(now: Date): Result<void, SurveyStateError> {
    if (this.state.status !== 'draft') {
      return err('SURVEY_NOT_EDITABLE');
    }
    this.state = { ...this.state, status: 'archived', updatedAt: now };
    return ok(undefined);
  }

  unarchive(now: Date): Result<void, SurveyStateError> {
    if (this.state.status !== 'archived') {
      return err('SURVEY_NOT_EDITABLE');
    }
    this.state = { ...this.state, status: 'draft', updatedAt: now };
    return ok(undefined);
  }

  /** Nothing from the field is ever deleted: only a draft can go (spec 013 rule 8). */
  canBeDeleted(): boolean {
    return this.state.status === 'draft';
  }

  /**
   * A new draft with the same settings. Period and TSE registration number are
   * not copied: they belong to one survey only.
   */
  duplicate(input: { id: string; title: string; now: Date }): Survey {
    const { tse } = this.state;
    return Survey.create({
      id: input.id,
      organizationId: this.state.organizationId,
      now: input.now,
      fields: {
        ...this.state,
        title: input.title.trim().slice(0, MAX_TITLE_LENGTH),
        fieldStart: null,
        fieldEnd: null,
        tse: tse ? { ...tse, registrationNumber: null } : null,
      },
    });
  }
}
