import { renameInCondition } from '@az-pesquisas/contracts';
import type {
  ConditionOperator,
  DraftComparison,
  DraftCondition,
  DraftMatrixRow,
  DraftOption,
  DraftQuestion,
  QuestionnaireDraft,
  QuestionType,
} from '@az-pesquisas/contracts';

/** Generates ids (UUID v7 in the app; deterministic in tests). */
export type NewId = () => string;

export type ItemList = 'options' | 'rows';
type Item = DraftOption | DraftMatrixRow;

// ---------------------------------------------------------------- creation

/** The first free code P01, P02… */
export const nextQuestionCode = (questions: readonly DraftQuestion[]): string => {
  const taken = new Set(questions.map((q) => q.code));
  const code = (n: number) => `P${String(n).padStart(2, '0')}`;
  let n = 1;
  while (taken.has(code(n))) {
    n += 1;
  }
  return code(n);
};

/** The first free numeric item code: "1", "2"… */
export const nextItemCode = (items: readonly { code: string }[]): string => {
  const taken = new Set(items.map((i) => i.code));
  let n = 1;
  while (taken.has(String(n))) {
    n += 1;
  }
  return String(n);
};

const blankOptions = (count: number, newId: NewId): DraftOption[] =>
  Array.from({ length: count }, (_, i) => ({ id: newId(), code: String(i + 1), label: '' }));

/** A new question of the given type with sensible defaults (spec 014 rule 10). */
export const newQuestion = (type: QuestionType, code: string, newId: NewId): DraftQuestion => {
  const base = { id: newId(), code, text: '', required: true };
  switch (type) {
    case 'single_choice':
      return { ...base, type, options: blankOptions(2, newId), shuffleOptions: false };
    case 'multiple_choice':
      return {
        ...base,
        type,
        options: blankOptions(3, newId),
        shuffleOptions: false,
        minSelections: 1,
      };
    case 'text':
      return { ...base, type, multiline: false, maxLength: 500 };
    case 'number':
      return { ...base, type, integer: true };
    case 'scale':
      return { ...base, type, min: 0, max: 10 };
    case 'matrix':
      return {
        ...base,
        type,
        rows: [{ id: newId(), code: '1', label: '' }],
        options: blankOptions(2, newId),
      };
    case 'ranking':
      return { ...base, type, options: blankOptions(3, newId) };
    case 'date':
      return { ...base, type };
    case 'photo':
      return { ...base, type, maxPhotos: 1 };
    case 'signature':
      return { ...base, type };
  }
};

// ---------------------------------------------------------------- reducer

export type EditorAction =
  | { type: 'insert'; question: DraftQuestion; index: number }
  | { type: 'update'; id: string; patch: Partial<DraftQuestion> }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string; newId: NewId }
  | { type: 'move'; id: string; to: number }
  | { type: 'setIntro'; text: string }
  | { type: 'addItem'; id: string; list: ItemList; item: Item }
  | { type: 'updateItem'; id: string; list: ItemList; index: number; patch: Partial<DraftOption> }
  | { type: 'removeItem'; id: string; list: ItemList; index: number }
  | { type: 'moveItem'; id: string; list: ItemList; from: number; to: number }
  | { type: 'setCondition'; id: string; condition: DraftCondition | undefined };

const move = <T>(items: readonly T[], from: number, to: number): T[] => {
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  if (moved === undefined) {
    return copy;
  }
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, moved);
  return copy;
};

const itemsOf = (q: DraftQuestion, list: ItemList): Item[] | undefined => {
  if (list === 'rows') {
    return q.type === 'matrix' ? q.rows : undefined;
  }
  return 'options' in q ? q.options : undefined;
};

const withItems = (q: DraftQuestion, list: ItemList, items: Item[]): DraftQuestion => ({
  ...q,
  [list]: items,
});

const mapQuestion = (
  draft: QuestionnaireDraft,
  id: string,
  change: (q: DraftQuestion) => DraftQuestion,
): QuestionnaireDraft => ({
  ...draft,
  questions: draft.questions.map((q) => (q.id === id ? change(q) : q)),
});

const withoutUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

/** Every edit of the questionnaire draft (spec 014). Pure: the editor keeps the result. */
export const editorReducer = (
  draft: QuestionnaireDraft,
  action: EditorAction,
): QuestionnaireDraft => {
  switch (action.type) {
    case 'insert': {
      const questions = [...draft.questions];
      questions.splice(action.index, 0, action.question);
      return { ...draft, questions };
    }
    case 'update': {
      const current = draft.questions.find((q) => q.id === action.id);
      if (!current) {
        return draft;
      }
      const updated = withoutUndefined({ ...current, ...action.patch } as DraftQuestion);
      const renamed = action.patch.code !== undefined && action.patch.code !== current.code;
      return {
        ...draft,
        questions: draft.questions.map((q) => {
          if (q.id === action.id) {
            return updated;
          }
          // A renamed code is renamed in the conditions that cite it (rule 7).
          return renamed && q.visibleIf
            ? { ...q, visibleIf: renameInCondition(q.visibleIf, current.code, updated.code) }
            : q;
        }),
      };
    }
    case 'remove':
      return { ...draft, questions: draft.questions.filter((q) => q.id !== action.id) };
    case 'duplicate': {
      const index = draft.questions.findIndex((q) => q.id === action.id);
      const original = draft.questions[index];
      if (!original) {
        return draft;
      }
      let copy: DraftQuestion = {
        ...original,
        id: action.newId(),
        code: nextQuestionCode(draft.questions),
      };
      for (const list of ['options', 'rows'] as const) {
        const items = itemsOf(copy, list);
        if (items) {
          copy = withItems(
            copy,
            list,
            items.map((item) => ({ ...item, id: action.newId() })),
          );
        }
      }
      return editorReducer(draft, { type: 'insert', question: copy, index: index + 1 });
    }
    case 'move': {
      const from = draft.questions.findIndex((q) => q.id === action.id);
      return from < 0 ? draft : { ...draft, questions: move(draft.questions, from, action.to) };
    }
    case 'setIntro':
      return { ...draft, introText: action.text === '' ? null : action.text };
    case 'addItem':
      return mapQuestion(draft, action.id, (q) => {
        const items = itemsOf(q, action.list);
        return items ? withItems(q, action.list, [...items, action.item]) : q;
      });
    case 'updateItem':
      return mapQuestion(draft, action.id, (q) => {
        const items = itemsOf(q, action.list);
        return items
          ? withItems(
              q,
              action.list,
              items.map((item, i) =>
                i === action.index ? withoutUndefined({ ...item, ...action.patch }) : item,
              ),
            )
          : q;
      });
    case 'removeItem':
      return mapQuestion(draft, action.id, (q) => {
        const items = itemsOf(q, action.list);
        return items
          ? withItems(
              q,
              action.list,
              items.filter((_, i) => i !== action.index),
            )
          : q;
      });
    case 'moveItem':
      return mapQuestion(draft, action.id, (q) => {
        const items = itemsOf(q, action.list);
        return items ? withItems(q, action.list, move(items, action.from, action.to)) : q;
      });
    case 'setCondition':
      return mapQuestion(draft, action.id, (q) => {
        const { visibleIf: _old, ...rest } = q;
        return action.condition ? { ...rest, visibleIf: action.condition } : rest;
      });
  }
};

// ---------------------------------------------------------------- conditions in the editor

/** The editor builds one level: comparisons joined by "all" or "any" (spec 014 rule 6). */
export interface EditableCondition {
  readonly mode: 'all' | 'any';
  readonly comparisons: readonly DraftComparison[];
}

/** null when the condition is nested deeper than the editor shows. */
export const toEditable = (condition: DraftCondition | undefined): EditableCondition | null => {
  if (!condition) {
    return { mode: 'all', comparisons: [] };
  }
  const flat = (children: readonly DraftCondition[]) =>
    children.every((c) => 'question' in c) ? (children as DraftComparison[]) : null;
  if ('all' in condition) {
    const comparisons = flat(condition.all);
    return comparisons ? { mode: 'all', comparisons } : null;
  }
  if ('any' in condition) {
    const comparisons = flat(condition.any);
    return comparisons ? { mode: 'any', comparisons } : null;
  }
  return 'not' in condition ? null : { mode: 'all', comparisons: [condition] };
};

export const fromEditable = (editable: EditableCondition): DraftCondition | undefined => {
  const [first, ...others] = editable.comparisons;
  if (!first) {
    return undefined;
  }
  if (others.length === 0) {
    return first;
  }
  return editable.mode === 'all'
    ? { all: [...editable.comparisons] }
    : { any: [...editable.comparisons] };
};

const CHOICE_OPS: readonly ConditionOperator[] = [
  'eq',
  'neq',
  'in',
  'notIn',
  'answered',
  'notAnswered',
];
const NUMERIC_OPS: readonly ConditionOperator[] = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'answered',
  'notAnswered',
];
const ANY_OPS: readonly ConditionOperator[] = ['answered', 'notAnswered'];

/** Which comparisons make sense for the referenced question (same rules as spec 006). */
export const operatorsFor = (type: QuestionType): readonly ConditionOperator[] => {
  if (type === 'single_choice' || type === 'multiple_choice') {
    return CHOICE_OPS;
  }
  return type === 'number' || type === 'scale' ? NUMERIC_OPS : ANY_OPS;
};

/** A comparison with a value that fits the operator and the referenced question. */
export const comparisonFor = (target: DraftQuestion, op: ConditionOperator): DraftComparison => {
  if (op === 'answered' || op === 'notAnswered') {
    return { question: target.code, op };
  }
  if ('options' in target && target.type !== 'matrix' && target.type !== 'ranking') {
    const first = target.options[0]?.code ?? '';
    return op === 'in' || op === 'notIn'
      ? { question: target.code, op, value: [first] }
      : { question: target.code, op, value: first };
  }
  const start = target.type === 'scale' ? target.min : 0;
  return { question: target.code, op, value: start };
};
