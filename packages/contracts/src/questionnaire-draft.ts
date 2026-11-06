import { z } from 'zod';

import { Id, IsoDateTime } from './common.js';
import {
  CONDITION_OPERATORS,
  ItemCode,
  PROFILE_KEYS,
  QuestionCode,
  QuestionnaireSnapshot,
} from './questionnaire.js';
import type { QuestionType, SurveySettings } from './questionnaire.js';

/**
 * The questionnaire DRAFT edited in the panel (spec 014). Same shape as the
 * questions of the published snapshot (spec 006), but it may be incomplete
 * while someone types: empty texts, one option, a code being edited. Only
 * structure and sizes are enforced here; `lintQuestionnaire` lists what still
 * blocks publication, and the snapshot schema is the final rule (spec 015).
 */

const DraftCode = z.string().max(40);
const DraftText = (max: number) => z.string().max(max);

// ---------------------------------------------------------------- conditions

export const DraftComparison = z.strictObject({
  question: DraftCode,
  op: z.enum(CONDITION_OPERATORS),
  value: z.union([DraftCode, z.number(), z.array(DraftCode).max(200)]).optional(),
});
export type DraftComparison = z.infer<typeof DraftComparison>;

export type DraftCondition =
  | DraftComparison
  | { readonly all: readonly DraftCondition[] }
  | { readonly any: readonly DraftCondition[] }
  | { readonly not: DraftCondition };

export const DraftCondition: z.ZodType<DraftCondition> = z.lazy(() =>
  z.union([
    DraftComparison,
    z.strictObject({ all: z.array(DraftCondition).min(1).max(50) }),
    z.strictObject({ any: z.array(DraftCondition).min(1).max(50) }),
    z.strictObject({ not: DraftCondition }),
  ]),
);

// ---------------------------------------------------------------- questions

export const DraftOption = z.strictObject({
  id: Id,
  code: DraftCode,
  label: DraftText(300),
  fixed: z.boolean().optional(),
  exclusive: z.boolean().optional(),
  other: z.boolean().optional(),
});
export type DraftOption = z.infer<typeof DraftOption>;

export const DraftMatrixRow = z.strictObject({
  id: Id,
  code: DraftCode,
  label: DraftText(300),
});
export type DraftMatrixRow = z.infer<typeof DraftMatrixRow>;

const DraftOptions = z.array(DraftOption).max(200);

const draftBase = {
  id: Id,
  code: DraftCode,
  text: DraftText(1000),
  helpText: DraftText(1000).optional(),
  required: z.boolean(),
  visibleIf: DraftCondition.optional(),
  profile: z.enum(PROFILE_KEYS).optional(),
};

export const DraftQuestion = z.discriminatedUnion('type', [
  z.strictObject({
    ...draftBase,
    type: z.literal('single_choice'),
    options: DraftOptions,
    shuffleOptions: z.boolean(),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('multiple_choice'),
    options: DraftOptions,
    shuffleOptions: z.boolean(),
    minSelections: z.int().min(0).max(200),
    maxSelections: z.int().min(1).max(200).optional(),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('text'),
    multiline: z.boolean(),
    maxLength: z.int().min(1).max(5000),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('number'),
    integer: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    unit: DraftText(20).optional(),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('scale'),
    min: z.int().min(-1000).max(1000),
    max: z.int().min(-1000).max(1000),
    minLabel: DraftText(60).optional(),
    maxLabel: DraftText(60).optional(),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('matrix'),
    rows: z.array(DraftMatrixRow).max(50),
    options: z.array(DraftOption).max(20),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('ranking'),
    options: DraftOptions,
    maxRanked: z.int().min(1).max(200).optional(),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('date'),
    min: z.iso.date().optional(),
    max: z.iso.date().optional(),
  }),
  z.strictObject({
    ...draftBase,
    type: z.literal('photo'),
    maxPhotos: z.int().min(1).max(5),
  }),
  z.strictObject({ ...draftBase, type: z.literal('signature') }),
]);
export type DraftQuestion = z.infer<typeof DraftQuestion>;

export const MAX_QUESTIONS = 500;

export const QuestionnaireDraft = z.strictObject({
  introText: DraftText(2000).nullable().default(null),
  questions: z.array(DraftQuestion).max(MAX_QUESTIONS),
});
export type QuestionnaireDraft = z.infer<typeof QuestionnaireDraft>;

export const EMPTY_QUESTIONNAIRE: QuestionnaireDraft = { introText: null, questions: [] };

// ---------------------------------------------------------------- API

/** Why the questionnaire cannot be edited (spec 014 rules 13 and 14). */
export const QUESTIONNAIRE_LOCKS = ['archived', 'tse_registered'] as const;
export type QuestionnaireLock = (typeof QUESTIONNAIRE_LOCKS)[number];

export const QuestionnaireView = z.object({
  surveyId: Id,
  /** Increments on every save; 0 = never saved. Sent back to detect concurrent edits. */
  revision: z.int().min(0),
  content: QuestionnaireDraft,
  lock: z.enum(QUESTIONNAIRE_LOCKS).nullable(),
  updatedAt: IsoDateTime.nullable(),
});
export type QuestionnaireView = z.infer<typeof QuestionnaireView>;

export const SaveQuestionnaireRequest = z.strictObject({
  /** The revision the editor started from. */
  revision: z.int().min(0),
  content: QuestionnaireDraft,
});
export type SaveQuestionnaireRequest = z.infer<typeof SaveQuestionnaireRequest>;

// ---------------------------------------------------------------- snapshot

/** What `QuestionnaireSnapshot` needs besides the questions (spec 015 fills it in). */
export interface SnapshotMeta {
  readonly surveyId: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly title: string;
  readonly settings: SurveySettings;
}

/** The draft as the app's snapshot input; parse it with `QuestionnaireSnapshot`. */
export const draftToSnapshotInput = (
  draft: QuestionnaireDraft,
  meta: SnapshotMeta,
): Record<string, unknown> => ({
  schemaVersion: 1,
  surveyId: meta.surveyId,
  versionId: meta.versionId,
  versionNumber: meta.versionNumber,
  title: meta.title,
  ...(draft.introText ? { introText: draft.introText } : {}),
  settings: meta.settings,
  questions: draft.questions.map((q) => {
    const trimmedHelp = q.helpText?.trim();
    const { helpText: _help, ...rest } = q;
    return trimmedHelp ? { ...rest, helpText: trimmedHelp } : rest;
  }),
});

// ---------------------------------------------------------------- lint

export const LINT_CODES = [
  'NO_QUESTIONS',
  'TEXT_EMPTY',
  'CODE_INVALID',
  'CODE_REPEATED',
  'PROFILE_REPEATED',
  'OPTIONS_TOO_FEW',
  'ROWS_EMPTY',
  'ITEM_LABEL_EMPTY',
  'ITEM_CODE_INVALID',
  'ITEM_CODE_REPEATED',
  'OTHER_REPEATED',
  'SELECTIONS_RANGE',
  'SCALE_RANGE',
  'NUMBER_RANGE',
  'DATE_RANGE',
  'RANKED_TOO_MANY',
  'CONDITION_REFERENCE',
  'CONDITION_INVALID',
  'INVALID',
] as const;
export type LintCode = (typeof LINT_CODES)[number];

/** Something that blocks publication; `questionId` absent = the questionnaire as a whole. */
export interface LintIssue {
  readonly code: LintCode;
  readonly questionId?: string;
  /** Option/row position (0-based) for item issues. */
  readonly item?: number;
  readonly list?: 'options' | 'rows';
}

const CHOICE: ReadonlySet<QuestionType> = new Set(['single_choice', 'multiple_choice', 'ranking']);

const comparisonsOf = (condition: DraftCondition): DraftComparison[] => {
  if ('all' in condition) {
    return condition.all.flatMap(comparisonsOf);
  }
  if ('any' in condition) {
    return condition.any.flatMap(comparisonsOf);
  }
  if ('not' in condition) {
    return comparisonsOf(condition.not);
  }
  return [condition];
};

const lintItems = (
  q: DraftQuestion,
  list: 'options' | 'rows',
  items: readonly { code: string; label: string; other?: boolean | undefined }[],
  push: (issue: LintIssue) => void,
): void => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (item.label.trim() === '') {
      push({ code: 'ITEM_LABEL_EMPTY', questionId: q.id, list, item: index });
    }
    if (!ItemCode.safeParse(item.code).success) {
      push({ code: 'ITEM_CODE_INVALID', questionId: q.id, list, item: index });
    } else if (seen.has(item.code)) {
      push({ code: 'ITEM_CODE_REPEATED', questionId: q.id, list, item: index });
    }
    seen.add(item.code);
  });
  if (items.filter((i) => i.other === true).length > 1) {
    push({ code: 'OTHER_REPEATED', questionId: q.id, list });
  }
};

const lintRanges = (q: DraftQuestion, push: (issue: LintIssue) => void): void => {
  const bad = (code: LintCode) => {
    push({ code, questionId: q.id });
  };
  switch (q.type) {
    case 'multiple_choice': {
      const max = q.maxSelections ?? q.options.length;
      if (max > q.options.length || q.minSelections > max) {
        bad('SELECTIONS_RANGE');
      }
      break;
    }
    case 'scale':
      if (q.max <= q.min || q.max - q.min > 100) {
        bad('SCALE_RANGE');
      }
      break;
    case 'number':
      if (q.min !== undefined && q.max !== undefined && q.min > q.max) {
        bad('NUMBER_RANGE');
      }
      break;
    case 'date':
      if (q.min !== undefined && q.max !== undefined && q.min > q.max) {
        bad('DATE_RANGE');
      }
      break;
    case 'ranking':
      if (q.maxRanked !== undefined && q.maxRanked > q.options.length) {
        bad('RANKED_TOO_MANY');
      }
      break;
    default:
      break;
  }
};

const PLACEHOLDER_META: SnapshotMeta = {
  surveyId: '00000000-0000-7000-8000-000000000000',
  versionId: '00000000-0000-7000-8000-000000000000',
  versionNumber: 1,
  title: 'lint',
  settings: { gps: 'off', audio: 'off', minDurationSec: 0 },
};

/**
 * Everything that still blocks publishing the draft, in question order. A draft
 * with no issues is always accepted by QuestionnaireSnapshot (spec 014 CA-05):
 * whatever the specific checks miss is caught by parsing the snapshot itself.
 */
export const lintQuestionnaire = (draft: QuestionnaireDraft): LintIssue[] => {
  const issues: LintIssue[] = [];
  const push = (issue: LintIssue) => {
    issues.push(issue);
  };
  if (draft.questions.length === 0) {
    push({ code: 'NO_QUESTIONS' });
    return issues;
  }

  const earlier = new Set<string>();
  const codes = new Set<string>();
  const profiles = new Set<string>();
  for (const q of draft.questions) {
    if (q.profile) {
      if (profiles.has(q.profile)) {
        push({ code: 'PROFILE_REPEATED', questionId: q.id });
      }
      profiles.add(q.profile);
    }
    if (q.text.trim() === '') {
      push({ code: 'TEXT_EMPTY', questionId: q.id });
    }
    if (!QuestionCode.safeParse(q.code).success) {
      push({ code: 'CODE_INVALID', questionId: q.id });
    } else if (codes.has(q.code)) {
      push({ code: 'CODE_REPEATED', questionId: q.id });
    }
    codes.add(q.code);

    if (CHOICE.has(q.type) && 'options' in q && q.options.length < 2) {
      push({ code: 'OPTIONS_TOO_FEW', questionId: q.id, list: 'options' });
    }
    if (q.type === 'matrix') {
      if (q.rows.length === 0) {
        push({ code: 'ROWS_EMPTY', questionId: q.id, list: 'rows' });
      }
      if (q.options.length < 2) {
        push({ code: 'OPTIONS_TOO_FEW', questionId: q.id, list: 'options' });
      }
      lintItems(q, 'rows', q.rows, push);
    }
    if ('options' in q) {
      lintItems(q, 'options', q.options, push);
    }
    lintRanges(q, push);

    if (q.visibleIf && comparisonsOf(q.visibleIf).some((c) => !earlier.has(c.question))) {
      push({ code: 'CONDITION_REFERENCE', questionId: q.id });
    }
    earlier.add(q.code);
  }

  if (issues.length === 0) {
    // The final rule: the app's snapshot schema (spec 006).
    const parsed = QuestionnaireSnapshot.safeParse(draftToSnapshotInput(draft, PLACEHOLDER_META));
    if (!parsed.success) {
      const flagged = new Set<string>();
      for (const zodIssue of parsed.error.issues) {
        const [root, index, field] = zodIssue.path;
        const question =
          root === 'questions' && typeof index === 'number' ? draft.questions[index] : undefined;
        const code: LintCode = field === 'visibleIf' ? 'CONDITION_INVALID' : 'INVALID';
        const key = `${question?.id ?? ''}:${code}`;
        if (!flagged.has(key)) {
          flagged.add(key);
          push(question ? { code, questionId: question.id } : { code });
        }
      }
    }
  }
  return issues;
};

// ---------------------------------------------------------------- editing helpers

/** Replaces the code of a question in a condition tree (spec 014 rule 7). */
export const renameInCondition = (
  condition: DraftCondition,
  from: string,
  to: string,
): DraftCondition => {
  if ('all' in condition) {
    return { all: condition.all.map((c) => renameInCondition(c, from, to)) };
  }
  if ('any' in condition) {
    return { any: condition.any.map((c) => renameInCondition(c, from, to)) };
  }
  if ('not' in condition) {
    return { not: renameInCondition(condition.not, from, to) };
  }
  return condition.question === from ? { ...condition, question: to } : condition;
};
