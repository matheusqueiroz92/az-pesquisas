import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';
import {
  isMunicipality,
  MAX_SURVEY_MUNICIPALITIES,
  MAX_TARGET_INTERVIEWS,
} from '@az-pesquisas/contracts';
import type {
  QuestionnaireLock,
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
  /** Latest published questionnaire version; 0 = never published (spec 015). */
  readonly publishedVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type SurveyStateError = 'SURVEY_NOT_EDITABLE';
export type SurveyUpdateError = SurveyStateError | 'SURVEY_FIELD_LOCKED';

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
      publishedVersion: 0,
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

  get publishedVersion(): number {
    return this.state.publishedVersion;
  }

  /**
   * Anything but an archived survey is edited. After the first publication the
   * type is fixed, and so is a TSE registration (spec 015 rules 11 and 13).
   */
  update(changes: SurveyChanges, now: Date): Result<{ changed: SurveyField[] }, SurveyUpdateError> {
    if (this.state.status === 'archived') {
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
    if (this.state.publishedVersion > 0) {
      const registration = this.state.tse?.registrationNumber;
      if (
        changed.includes('type') ||
        (registration && next.tse?.registrationNumber !== registration)
      ) {
        return err('SURVEY_FIELD_LOCKED');
      }
    }
    if (changed.length > 0) {
      this.state = { ...this.state, ...next, updatedAt: now };
    }
    return ok({ changed });
  }

  /** Draft and closed surveys are archived (spec 015 rule 12). */
  archive(now: Date): Result<void, SurveyStateError> {
    return this.move(['draft', 'closed'], 'archived', now);
  }

  /** Back to where it was: draft if never published, otherwise closed. */
  unarchive(now: Date): Result<void, SurveyStateError> {
    return this.move(['archived'], this.state.publishedVersion > 0 ? 'closed' : 'draft', now);
  }

  /** Stops the fieldwork (spec 015 rule 12). */
  close(now: Date): Result<void, SurveyStateError> {
    return this.move(['in_field'], 'closed', now);
  }

  reopen(now: Date): Result<void, SurveyStateError> {
    return this.move(['closed'], 'in_field', now);
  }

  /** Records a new published version; the first one puts a draft in the field. */
  markPublished(versionNumber: number, now: Date): Result<void, SurveyStateError> {
    if (this.state.status === 'archived' || versionNumber !== this.state.publishedVersion + 1) {
      return err('SURVEY_NOT_EDITABLE');
    }
    this.state = {
      ...this.state,
      publishedVersion: versionNumber,
      status: this.state.status === 'draft' ? 'in_field' : this.state.status,
      updatedAt: now,
    };
    return ok(undefined);
  }

  private move(
    from: readonly SurveyStatus[],
    to: SurveyStatus,
    now: Date,
  ): Result<void, SurveyStateError> {
    if (!from.includes(this.state.status)) {
      return err('SURVEY_NOT_EDITABLE');
    }
    this.state = { ...this.state, status: to, updatedAt: now };
    return ok(undefined);
  }

  /**
   * Why the questionnaire cannot be edited, or null (spec 014 rules 13–14): an
   * archived survey, or an electoral one already registered at the TSE.
   */
  questionnaireLock(): QuestionnaireLock | null {
    if (this.state.status === 'archived') {
      return 'archived';
    }
    return this.state.tse?.registrationNumber ? 'tse_registered' : null;
  }

  /** Nothing from the field is ever deleted: only a never-published draft can go (spec 013 rule 8). */
  canBeDeleted(): boolean {
    return this.state.status === 'draft' && this.state.publishedVersion === 0;
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
