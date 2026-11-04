import { z } from 'zod';

import { Id } from './common.js';

/**
 * Snapshot of a PUBLISHED questionnaire version (spec 006): what the app downloads
 * and what becomes the PDF for the TSE. Server -> app, so objects are tolerant:
 * unknown fields are ignored, letting the API add optional fields without
 * breaking apps already in the field. Structural rules are enforced below;
 * evaluating visibleIf and validating answers is the engine's job (F1).
 */

/** Export variable of a question, e.g. P01_SEXO. */
export const QuestionCode = z.string().regex(/^[A-Z][A-Z0-9_]{0,39}$/);
/** Exported value of an option or matrix row, e.g. "1", "NS_NR". */
export const ItemCode = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);

// ---------------------------------------------------------------- visibleIf

export const CONDITION_OPERATORS = [
  'eq',
  'neq',
  'in',
  'notIn',
  'gt',
  'gte',
  'lt',
  'lte',
  'answered',
  'notAnswered',
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export const Comparison = z.strictObject({
  /** Code of an EARLIER question. */
  question: QuestionCode,
  op: z.enum(CONDITION_OPERATORS),
  value: z.union([ItemCode, z.number(), z.array(ItemCode).min(1).max(200)]).optional(),
});
export type Comparison = z.infer<typeof Comparison>;

export type Condition =
  | Comparison
  | { readonly all: readonly Condition[] }
  | { readonly any: readonly Condition[] }
  | { readonly not: Condition };

export const Condition: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    Comparison,
    z.strictObject({ all: z.array(Condition).min(1).max(50) }),
    z.strictObject({ any: z.array(Condition).min(1).max(50) }),
    z.strictObject({ not: Condition }),
  ]),
);

export const MAX_CONDITION_DEPTH = 5;
export const MAX_COMPARISONS = 50;

// ---------------------------------------------------------------- questions

export const Option = z.object({
  id: Id,
  code: ItemCode,
  label: z.string().min(1).max(300),
  /** Stays in place when the other options are shuffled ("Não sabe", "Outro"). */
  fixed: z.boolean().optional(),
  /** Multiple choice: selecting it clears the others ("Nenhuma"). */
  exclusive: z.boolean().optional(),
  /** Asks for free text ("Outro, especificar"). At most one per question. */
  other: z.boolean().optional(),
});
export type Option = z.infer<typeof Option>;

const questionBase = {
  id: Id,
  code: QuestionCode,
  text: z.string().min(1).max(1000),
  /** Instruction for the interviewer, never read to the respondent. */
  helpText: z.string().max(1000).optional(),
  required: z.boolean(),
  visibleIf: Condition.optional(),
};

const Options = z.array(Option).min(2).max(200);

export const SingleChoiceQuestion = z.object({
  ...questionBase,
  type: z.literal('single_choice'),
  options: Options,
  shuffleOptions: z.boolean().default(false),
});

export const MultipleChoiceQuestion = z.object({
  ...questionBase,
  type: z.literal('multiple_choice'),
  options: Options,
  shuffleOptions: z.boolean().default(false),
  minSelections: z.int().min(0).default(0),
  maxSelections: z.int().min(1).optional(),
});

export const TextQuestion = z.object({
  ...questionBase,
  type: z.literal('text'),
  multiline: z.boolean().default(false),
  maxLength: z.int().min(1).max(5000).default(500),
});

export const NumberQuestion = z.object({
  ...questionBase,
  type: z.literal('number'),
  integer: z.boolean().default(true),
  min: z.number().optional(),
  max: z.number().optional(),
  unit: z.string().max(20).optional(),
});

export const ScaleQuestion = z.object({
  ...questionBase,
  type: z.literal('scale'),
  min: z.int(),
  max: z.int(),
  minLabel: z.string().max(60).optional(),
  maxLabel: z.string().max(60).optional(),
});

export const MatrixRow = z.object({
  id: Id,
  code: ItemCode,
  label: z.string().min(1).max(300),
});

export const MatrixQuestion = z.object({
  ...questionBase,
  type: z.literal('matrix'),
  rows: z.array(MatrixRow).min(1).max(50),
  /** The columns; one answer per row. */
  options: z.array(Option).min(2).max(20),
});

export const RankingQuestion = z.object({
  ...questionBase,
  type: z.literal('ranking'),
  options: Options,
  /** Rank only the top N (e.g. top 3); all options when absent. */
  maxRanked: z.int().min(1).optional(),
});

export const DateQuestion = z.object({
  ...questionBase,
  type: z.literal('date'),
  min: z.iso.date().optional(),
  max: z.iso.date().optional(),
});

export const PhotoQuestion = z.object({
  ...questionBase,
  type: z.literal('photo'),
  maxPhotos: z.int().min(1).max(5).default(1),
});

export const SignatureQuestion = z.object({
  ...questionBase,
  type: z.literal('signature'),
});

export const Question = z.discriminatedUnion('type', [
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  TextQuestion,
  NumberQuestion,
  ScaleQuestion,
  MatrixQuestion,
  RankingQuestion,
  DateQuestion,
  PhotoQuestion,
  SignatureQuestion,
]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question['type'];
export const QUESTION_TYPES = Question.options.map((o) => o.shape.type.value);

// ---------------------------------------------------------------- snapshot

export const SurveySettings = z.object({
  gps: z.enum(['off', 'optional', 'required']),
  audio: z.enum(['off', 'on']),
  /** Interviews shorter than this are flagged for audit (not rejected). */
  minDurationSec: z.int().min(0).max(7200).default(0),
  consentText: z.string().min(1).max(2000).optional(),
});
export type SurveySettings = z.infer<typeof SurveySettings>;

interface Issue {
  path: (string | number)[];
  message: string;
}

const CHOICE_TYPES = new Set<QuestionType>(['single_choice', 'multiple_choice']);
const NUMERIC_TYPES = new Set<QuestionType>(['number', 'scale']);

/** Checks one comparison against the question it references. */
const checkComparison = (
  comparison: Comparison,
  path: (string | number)[],
  earlier: ReadonlyMap<string, Question>,
  issues: Issue[],
): void => {
  const target = earlier.get(comparison.question);
  if (!target) {
    issues.push({
      path: [...path, 'question'],
      message: 'visibleIf may only reference an earlier question of this questionnaire',
    });
    return;
  }

  const { op, value } = comparison;
  if (op === 'answered' || op === 'notAnswered') {
    if (value !== undefined) {
      issues.push({ path: [...path, 'value'], message: `"${op}" takes no value` });
    }
    return;
  }

  if (CHOICE_TYPES.has(target.type)) {
    const codes = new Set('options' in target ? target.options.map((o) => o.code) : []);
    const isList = op === 'in' || op === 'notIn';
    if (!isList && op !== 'eq' && op !== 'neq') {
      issues.push({ path: [...path, 'op'], message: `"${op}" does not apply to choice questions` });
      return;
    }
    if (isList !== Array.isArray(value)) {
      issues.push({
        path: [...path, 'value'],
        message: isList ? `"${op}" needs a list of option codes` : `"${op}" needs one option code`,
      });
      return;
    }
    const values: unknown[] = Array.isArray(value) ? value : [value];
    if (!values.every((v) => typeof v === 'string' && codes.has(v))) {
      issues.push({
        path: [...path, 'value'],
        message: 'every value must be an option code of the referenced question',
      });
    }
    return;
  }

  if (NUMERIC_TYPES.has(target.type)) {
    if (op === 'in' || op === 'notIn') {
      issues.push({
        path: [...path, 'op'],
        message: `"${op}" does not apply to numeric questions`,
      });
    } else if (typeof value !== 'number') {
      issues.push({ path: [...path, 'value'], message: `"${op}" needs a numeric value` });
    }
    return;
  }

  issues.push({
    path: [...path, 'op'],
    message: `only "answered"/"notAnswered" apply to ${target.type} questions`,
  });
};

/** Walks a condition tree: depth, number of comparisons and each comparison. */
const checkCondition = (
  condition: Condition,
  path: (string | number)[],
  earlier: ReadonlyMap<string, Question>,
  issues: Issue[],
): { depth: number; comparisons: number } => {
  if ('not' in condition) {
    const inner = checkCondition(condition.not, [...path, 'not'], earlier, issues);
    return { depth: inner.depth + 1, comparisons: inner.comparisons };
  }
  if ('all' in condition || 'any' in condition) {
    const key = 'all' in condition ? 'all' : 'any';
    const children = 'all' in condition ? condition.all : condition.any;
    let depth = 0;
    let comparisons = 0;
    children.forEach((child, index) => {
      const r = checkCondition(child, [...path, key, index], earlier, issues);
      depth = Math.max(depth, r.depth);
      comparisons += r.comparisons;
    });
    return { depth: depth + 1, comparisons };
  }
  checkComparison(condition, path, earlier, issues);
  return { depth: 0, comparisons: 1 };
};

const findDuplicates = <T>(items: readonly T[], key: (item: T) => string): number[] => {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  items.forEach((item, index) => {
    const k = key(item);
    if (seen.has(k)) {
      duplicates.push(index);
    }
    seen.add(k);
  });
  return duplicates;
};

/** Per-type rules that need more than one field. */
const checkQuestion = (q: Question, path: (string | number)[], issues: Issue[]): void => {
  if ('options' in q) {
    for (const i of findDuplicates(q.options, (o) => o.id)) {
      issues.push({ path: [...path, 'options', i, 'id'], message: 'repeated option id' });
    }
    for (const i of findDuplicates(q.options, (o) => o.code)) {
      issues.push({ path: [...path, 'options', i, 'code'], message: 'repeated option code' });
    }
    if (q.options.filter((o) => o.other).length > 1) {
      issues.push({ path: [...path, 'options'], message: 'at most one "other" option' });
    }
  }

  switch (q.type) {
    case 'multiple_choice': {
      const max = q.maxSelections ?? q.options.length;
      if (max > q.options.length) {
        issues.push({
          path: [...path, 'maxSelections'],
          message: 'maxSelections cannot exceed the number of options',
        });
      }
      if (q.minSelections > max) {
        issues.push({
          path: [...path, 'minSelections'],
          message: 'minSelections cannot exceed maxSelections',
        });
      }
      break;
    }
    case 'scale':
      if (q.max <= q.min || q.max - q.min > 100) {
        issues.push({
          path: [...path, 'max'],
          message: 'a scale needs min < max and at most 101 points',
        });
      }
      break;
    case 'number':
      if (q.min !== undefined && q.max !== undefined && q.min > q.max) {
        issues.push({
          path: [...path, 'max'],
          message: 'max must be greater than or equal to min',
        });
      }
      break;
    case 'date':
      if (q.min !== undefined && q.max !== undefined && q.min > q.max) {
        issues.push({ path: [...path, 'max'], message: 'max must be on or after min' });
      }
      break;
    case 'matrix':
      for (const i of findDuplicates(q.rows, (r) => r.id)) {
        issues.push({ path: [...path, 'rows', i, 'id'], message: 'repeated row id' });
      }
      for (const i of findDuplicates(q.rows, (r) => r.code)) {
        issues.push({ path: [...path, 'rows', i, 'code'], message: 'repeated row code' });
      }
      break;
    case 'ranking':
      if (q.maxRanked !== undefined && q.maxRanked > q.options.length) {
        issues.push({
          path: [...path, 'maxRanked'],
          message: 'maxRanked cannot exceed the number of options',
        });
      }
      break;
    default:
      break;
  }
};

export const QuestionnaireSnapshot = z
  .object({
    schemaVersion: z.literal(1),
    surveyId: Id,
    versionId: Id,
    versionNumber: z.int().min(1),
    title: z.string().min(1).max(200),
    introText: z.string().max(2000).optional(),
    settings: SurveySettings,
    questions: z.array(Question).min(1).max(500),
  })
  .superRefine((snapshot, ctx) => {
    const issues: Issue[] = [];
    const { questions } = snapshot;

    for (const i of findDuplicates(questions, (q) => q.id)) {
      issues.push({ path: ['questions', i, 'id'], message: 'repeated question id' });
    }
    for (const i of findDuplicates(questions, (q) => q.code)) {
      issues.push({ path: ['questions', i, 'code'], message: 'repeated question code' });
    }

    // Only questions BEFORE the current one are visible to its condition: no cycles possible.
    const earlier = new Map<string, Question>();
    questions.forEach((q, index) => {
      const path = ['questions', index];
      checkQuestion(q, path, issues);
      if (q.visibleIf) {
        const conditionPath = [...path, 'visibleIf'];
        const { depth, comparisons } = checkCondition(q.visibleIf, conditionPath, earlier, issues);
        if (depth > MAX_CONDITION_DEPTH) {
          issues.push({
            path: conditionPath,
            message: `conditions may nest at most ${MAX_CONDITION_DEPTH} levels`,
          });
        }
        if (comparisons > MAX_COMPARISONS) {
          issues.push({
            path: conditionPath,
            message: `at most ${MAX_COMPARISONS} comparisons per question`,
          });
        }
      }
      if (!earlier.has(q.code)) {
        earlier.set(q.code, q);
      }
    });

    for (const issue of issues) {
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
    }
  });
export type QuestionnaireSnapshot = z.infer<typeof QuestionnaireSnapshot>;
