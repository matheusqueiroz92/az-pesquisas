import { z } from 'zod';

import { Id, IsoDateTime } from './common.js';
import { QuestionnaireSnapshot } from './questionnaire.js';
import type { Question } from './questionnaire.js';
import { LINT_CODES } from './questionnaire-draft.js';

/**
 * Published questionnaire versions (spec 015): what changes from one version to
 * the next, the publication preview and the views of the panel.
 */

// ---------------------------------------------------------------- changes

export const VERSION_CHANGE_KINDS = [
  'title',
  'intro',
  'settings',
  'question_added',
  'question_removed',
  'question_text',
  'question_code',
  'question_settings',
  'question_type',
  'item_added',
  'item_removed',
  'item_text',
  'item_code',
] as const;
export type VersionChangeKind = (typeof VERSION_CHANGE_KINDS)[number];

export const VersionChange = z.object({
  kind: z.enum(VERSION_CHANGE_KINDS),
  /** Question involved, with its code in the NEW version (old one when removed). */
  questionId: Id.optional(),
  questionCode: z.string().optional(),
  /** Option or matrix row involved. */
  list: z.enum(['options', 'rows']).optional(),
  itemId: Id.optional(),
  itemLabel: z.string().optional(),
  /** Code before and after (question_code, item_code). */
  from: z.string().optional(),
  to: z.string().optional(),
});
export type VersionChange = z.infer<typeof VersionChange>;

/** Changes that make answers before and after the version harder to compare (spec 015 rule 7). */
export const affectsComparability = (change: VersionChange): boolean =>
  change.kind === 'item_added' || change.kind === 'item_removed' || change.kind === 'question_text';

/** Changes the publication refuses (spec 015 rule 9). */
export const isIncompatible = (change: VersionChange): boolean => change.kind === 'question_type';

interface Item {
  id: string;
  code: string;
  label: string;
}

const itemsOf = (q: Question, list: 'options' | 'rows'): Item[] => {
  if (list === 'rows') {
    return q.type === 'matrix' ? q.rows : [];
  }
  return 'options' in q ? q.options : [];
};

/** JSON with sorted keys: snapshots read back from JSONB do not keep key order. */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );

const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** What a question is besides its id, code, text and items: compared as "settings". */
const settingsOf = (q: Question): unknown => {
  const { id: _id, code: _code, text: _text, ...rest } = q;
  const withoutItems: Record<string, unknown> = { ...rest };
  delete withoutItems['options'];
  delete withoutItems['rows'];
  return withoutItems;
};

/** Flags of an option (fixed, exclusive, other): what is left besides id, code and label. */
const flagsOf = (item: Item): unknown => {
  const { id: _id, code: _code, label: _label, ...flags } = item;
  return flags;
};

/**
 * Differences between two published snapshots, matched by the stable ids of
 * questions, options and rows (spec 015 rule 8), in the order of the new one
 * (removed questions at the end).
 */
export const compareVersions = (
  previous: QuestionnaireSnapshot,
  next: QuestionnaireSnapshot,
): VersionChange[] => {
  const changes: VersionChange[] = [];
  if (previous.title !== next.title) {
    changes.push({ kind: 'title' });
  }
  if ((previous.introText ?? '') !== (next.introText ?? '')) {
    changes.push({ kind: 'intro' });
  }
  if (!same(previous.settings, next.settings)) {
    changes.push({ kind: 'settings' });
  }

  const before = new Map(previous.questions.map((q) => [q.id, q]));
  for (const q of next.questions) {
    const old = before.get(q.id);
    const ref = { questionId: q.id, questionCode: q.code };
    if (!old) {
      changes.push({ kind: 'question_added', ...ref });
      continue;
    }
    if (old.type !== q.type) {
      changes.push({ kind: 'question_type', ...ref });
      continue;
    }
    if (old.code !== q.code) {
      changes.push({ kind: 'question_code', ...ref, from: old.code, to: q.code });
    }
    if (old.text !== q.text) {
      changes.push({ kind: 'question_text', ...ref });
    }
    let flagsChanged = false;
    for (const list of ['rows', 'options'] as const) {
      const oldItems = new Map(itemsOf(old, list).map((i) => [i.id, i]));
      const newItems = itemsOf(q, list);
      const newIds = new Set(newItems.map((i) => i.id));
      for (const item of newItems) {
        const was = oldItems.get(item.id);
        const at = { ...ref, list, itemId: item.id, itemLabel: item.label };
        if (!was) {
          changes.push({ kind: 'item_added', ...at });
          continue;
        }
        if (was.code !== item.code) {
          changes.push({ kind: 'item_code', ...at, from: was.code, to: item.code });
        }
        if (was.label !== item.label) {
          changes.push({ kind: 'item_text', ...at });
        }
        flagsChanged ||= !same(flagsOf(was), flagsOf(item));
      }
      for (const item of oldItems.values()) {
        if (!newIds.has(item.id)) {
          changes.push({
            kind: 'item_removed',
            ...ref,
            list,
            itemId: item.id,
            itemLabel: item.label,
          });
        }
      }
    }
    if (flagsChanged || !same(settingsOf(old), settingsOf(q))) {
      changes.push({ kind: 'question_settings', ...ref });
    }
  }
  const nextIds = new Set(next.questions.map((q) => q.id));
  for (const old of previous.questions) {
    if (!nextIds.has(old.id)) {
      changes.push({ kind: 'question_removed', questionId: old.id, questionCode: old.code });
    }
  }
  return changes;
};

// ---------------------------------------------------------------- API

/** TSE fields a registered electoral survey needs before publishing (spec 015 rule 10). */
export const TSE_REQUIRED_FIELDS = [
  'registrationNumber',
  'statisticianName',
  'statisticianConre',
  'contractorName',
  'contractValueCents',
] as const;
export type TseRequiredField = (typeof TSE_REQUIRED_FIELDS)[number];

export const PublicationPreview = z.object({
  /** The draft revision this preview is about; send it back to publish. */
  revision: z.int().min(0),
  nextVersionNumber: z.int().min(1),
  issues: z.array(
    z.object({
      code: z.enum(LINT_CODES),
      questionId: z.string().optional(),
      item: z.int().optional(),
      list: z.enum(['options', 'rows']).optional(),
    }),
  ),
  tseMissing: z.array(z.enum(TSE_REQUIRED_FIELDS)),
  /** Empty on the first publication. */
  changes: z.array(VersionChange),
  /** Why it cannot be published now, if anything: first match of the rules. */
  blocker: z
    .enum([
      'QUESTIONNAIRE_NOT_PUBLISHABLE',
      'QUESTIONNAIRE_UNCHANGED',
      'QUESTIONNAIRE_INCOMPATIBLE',
      'SURVEY_TSE_INCOMPLETE',
      'SURVEY_NOT_EDITABLE',
    ])
    .nullable(),
});
export type PublicationPreview = z.infer<typeof PublicationPreview>;

export const PublishQuestionnaireRequest = z.strictObject({
  /** The saved draft revision the coordinator reviewed. */
  revision: z.int().min(0),
});
export type PublishQuestionnaireRequest = z.infer<typeof PublishQuestionnaireRequest>;

export const QuestionnaireVersionSummary = z.object({
  id: Id,
  number: z.int().min(1),
  publishedAt: IsoDateTime,
  questionCount: z.int().min(0),
  changes: z.array(VersionChange),
});
export type QuestionnaireVersionSummary = z.infer<typeof QuestionnaireVersionSummary>;

export const QuestionnaireVersionList = z.object({
  items: z.array(QuestionnaireVersionSummary),
});
export type QuestionnaireVersionList = z.infer<typeof QuestionnaireVersionList>;

export const QuestionnaireVersionView = QuestionnaireVersionSummary.extend({
  snapshot: QuestionnaireSnapshot,
});
export type QuestionnaireVersionView = z.infer<typeof QuestionnaireVersionView>;
