import type { Condition, Question, VersionChange } from '@az-pesquisas/contracts';

import { t } from '@/i18n/pt-BR';

/** One line describing a change between versions (spec 015). */
export const describeChange = (change: VersionChange): string => {
  const q = change.questionCode ?? '';
  switch (change.kind) {
    case 'title':
    case 'intro':
    case 'settings':
      return t.changeKinds[change.kind]();
    case 'question_code':
    case 'item_code':
      return t.changeKinds[change.kind](q, change.from, change.to);
    case 'item_added':
    case 'item_removed':
    case 'item_text':
      return t.changeKinds[change.kind](q, change.itemLabel);
    default:
      return t.changeKinds[change.kind](q);
  }
};

const valueText = (question: Question | undefined, value: string): string => {
  const option =
    question && 'options' in question ? question.options.find((o) => o.code === value) : undefined;
  return option ? `${value} (${option.label})` : value;
};

/** A display condition written out, for the printed questionnaire (spec 015 rule 16). */
export const describeCondition = (condition: Condition, questions: readonly Question[]): string => {
  const V = t.versions;
  if ('all' in condition) {
    return condition.all.map((c) => describeCondition(c, questions)).join(V.all);
  }
  if ('any' in condition) {
    return `(${condition.any.map((c) => describeCondition(c, questions)).join(V.any)})`;
  }
  if ('not' in condition) {
    return `${V.not}(${describeCondition(condition.not, questions)})`;
  }
  const target = questions.find((q) => q.code === condition.question);
  const op = t.operators[condition.op];
  const { value } = condition;
  if (value === undefined) {
    return `${condition.question} ${op}`;
  }
  const shown = Array.isArray(value)
    ? value.map((v) => valueText(target, v)).join(', ')
    : typeof value === 'string'
      ? valueText(target, value)
      : String(value);
  return `${condition.question} ${op} ${shown}`;
};
