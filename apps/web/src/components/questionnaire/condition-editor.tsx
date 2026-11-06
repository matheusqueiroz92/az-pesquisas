'use client';

import type { ConditionOperator, DraftComparison, DraftQuestion } from '@az-pesquisas/contracts';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';
import { comparisonFor, fromEditable, operatorsFor, toEditable } from '@/lib/questionnaire-editor';
import type { EditableCondition, EditorAction } from '@/lib/questionnaire-editor';

const C = t.questionnaire.condition;
const SELECT =
  'h-10 rounded-sm border border-border-strong bg-surface px-2.5 text-sm hover:border-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30';

const choiceOptionsOf = (q: DraftQuestion | undefined) =>
  q && (q.type === 'single_choice' || q.type === 'multiple_choice') ? q.options : undefined;

function ValueInput({
  comparison,
  target,
  label,
  onChange,
}: {
  comparison: DraftComparison;
  target: DraftQuestion | undefined;
  label: string;
  onChange: (value: DraftComparison['value']) => void;
}) {
  const { op, value } = comparison;
  if (op === 'answered' || op === 'notAnswered') {
    return null;
  }
  const options = choiceOptionsOf(target);
  if (options && (op === 'in' || op === 'notIn')) {
    const chosen = new Set(Array.isArray(value) ? value : []);
    return (
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="sr-only">{label}</legend>
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={chosen.has(o.code)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...chosen, o.code]
                  : [...chosen].filter((c) => c !== o.code);
                onChange(next);
              }}
              className="size-4 accent-primary"
            />
            {o.label || o.code}
          </label>
        ))}
      </fieldset>
    );
  }
  if (options) {
    return (
      <select
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={SELECT}
      >
        {options.map((o) => (
          <option key={o.id} value={o.code}>
            {o.code} — {o.label || '…'}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label={label}
      type="number"
      step="any"
      value={typeof value === 'number' ? value : ''}
      onChange={(event) => {
        const number = Number(event.target.value);
        onChange(event.target.value === '' || !Number.isFinite(number) ? 0 : number);
      }}
      className={`${SELECT} w-28`}
    />
  );
}

/** "Show this question only if…" over earlier questions (spec 014 rule 6). */
export function ConditionEditor({
  question,
  earlier,
  edit,
}: {
  question: DraftQuestion;
  earlier: readonly DraftQuestion[];
  edit: (action: EditorAction) => void;
}) {
  const editable = toEditable(question.visibleIf);
  const set = (next: EditableCondition) => {
    edit({ type: 'setCondition', id: question.id, condition: fromEditable(next) });
  };

  if (editable === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-muted-foreground">{C.advanced}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            edit({ type: 'setCondition', id: question.id, condition: undefined });
          }}
        >
          {C.clear}
        </Button>
      </div>
    );
  }
  if (earlier.length === 0 && editable.comparisons.length === 0) {
    return <p className="text-sm text-muted-foreground">{C.noEarlier}</p>;
  }

  const byCode = new Map(earlier.map((q) => [q.code, q]));
  const replace = (index: number, comparison: DraftComparison) => {
    set({
      ...editable,
      comparisons: editable.comparisons.map((c, i) => (i === index ? comparison : c)),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {editable.comparisons.length === 0 ? (
        <p className="text-sm text-muted-foreground">{C.always}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{C.showIf}</span>
          {editable.comparisons.length > 1 ? (
            <select
              aria-label={C.showIf}
              value={editable.mode}
              onChange={(event) => {
                set({ ...editable, mode: event.target.value === 'any' ? 'any' : 'all' });
              }}
              className={SELECT}
            >
              <option value="all">{C.all}</option>
              <option value="any">{C.any}</option>
            </select>
          ) : null}
        </div>
      )}
      <ol className="flex flex-col gap-2">
        {editable.comparisons.map((comparison, index) => {
          const target = byCode.get(comparison.question);
          const ops = target ? operatorsFor(target.type) : [comparison.op];
          const n = String(index + 1);
          return (
            <li
              key={`${n}-${comparison.question}`}
              data-testid="condition-row"
              className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-surface-sunken/40 p-2"
            >
              <select
                aria-label={`${C.question} ${n}`}
                value={comparison.question}
                onChange={(event) => {
                  const next = byCode.get(event.target.value);
                  if (next) {
                    const keep = operatorsFor(next.type).includes(comparison.op);
                    replace(index, comparisonFor(next, keep ? comparison.op : 'answered'));
                  }
                }}
                className={SELECT}
              >
                {target ? null : (
                  <option value={comparison.question}>{comparison.question} (?)</option>
                )}
                {earlier.map((q) => (
                  <option key={q.id} value={q.code}>
                    {q.code} — {q.text.slice(0, 40) || t.questionnaire.untitled}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${C.operator} ${n}`}
                value={comparison.op}
                onChange={(event) => {
                  const op = event.target.value as ConditionOperator;
                  replace(index, target ? comparisonFor(target, op) : { ...comparison, op });
                }}
                className={SELECT}
              >
                {ops.map((op) => (
                  <option key={op} value={op}>
                    {t.operators[op]}
                  </option>
                ))}
              </select>
              <ValueInput
                comparison={comparison}
                target={target}
                label={`${C.value} ${n}`}
                onChange={(value) => {
                  replace(index, value === undefined ? comparison : { ...comparison, value });
                }}
              />
              <button
                type="button"
                aria-label={`${C.remove} ${n}`}
                onClick={() => {
                  set({
                    ...editable,
                    comparisons: editable.comparisons.filter((_, i) => i !== index),
                  });
                }}
                className="ml-auto grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          );
        })}
      </ol>
      {earlier.length > 0 ? (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const last = earlier[earlier.length - 1];
              if (last) {
                const op = choiceOptionsOf(last) ? 'eq' : 'answered';
                set({
                  ...editable,
                  comparisons: [...editable.comparisons, comparisonFor(last, op)],
                });
              }
            }}
          >
            <Plus aria-hidden />
            {C.add}
          </Button>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{C.skipHint}</p>
    </div>
  );
}
