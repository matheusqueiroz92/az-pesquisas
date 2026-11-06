'use client';

import type { DraftMatrixRow, DraftOption } from '@az-pesquisas/contracts';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';
import { nextItemCode } from '@/lib/questionnaire-editor';
import type { EditorAction, ItemList, NewId } from '@/lib/questionnaire-editor';

const I = t.questionnaire.items;
const INPUT =
  'h-10 w-full rounded-sm border border-border-strong bg-surface px-3 text-sm hover:border-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30 aria-invalid:border-error';
const ICON_BUTTON =
  'grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

type Flag = 'fixed' | 'exclusive' | 'other';

/** Options, matrix columns or matrix rows of one question. */
export function ItemsEditor({
  questionId,
  list,
  title,
  addLabel,
  items,
  flags,
  invalidItems,
  newId,
  edit,
}: {
  questionId: string;
  list: ItemList;
  title: string;
  addLabel: string;
  items: readonly (DraftOption | DraftMatrixRow)[];
  /** Which per-option switches this question type has. */
  flags: readonly Flag[];
  /** Positions flagged by the pending-issues check. */
  invalidItems: ReadonlySet<number>;
  newId: NewId;
  edit: (action: EditorAction) => void;
}) {
  const flagLabels: Record<Flag, { label: string; hint: string }> = {
    fixed: { label: I.fixed, hint: I.fixedHint },
    exclusive: { label: I.exclusive, hint: I.exclusiveHint },
    other: { label: I.other, hint: I.otherHint },
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => {
          const position = I.position(index + 1);
          const invalid = invalidItems.has(index);
          return (
            <li
              key={item.id}
              data-testid={`${list}-item`}
              className={cn(
                'flex flex-wrap items-center gap-2 rounded-sm border bg-surface-sunken/40 p-2',
                invalid ? 'border-error' : 'border-border',
              )}
            >
              <input
                aria-label={`${I.code} (${position})`}
                value={item.code}
                maxLength={40}
                onChange={(event) => {
                  edit({
                    type: 'updateItem',
                    id: questionId,
                    list,
                    index,
                    patch: { code: event.target.value.trim() },
                  });
                }}
                className={cn(INPUT, 'w-20 shrink-0 font-mono')}
              />
              <input
                aria-label={`${I.label} (${position})`}
                value={item.label}
                maxLength={300}
                aria-invalid={invalid && item.label.trim() === '' ? true : undefined}
                placeholder={I.label}
                onChange={(event) => {
                  edit({
                    type: 'updateItem',
                    id: questionId,
                    list,
                    index,
                    patch: { label: event.target.value },
                  });
                }}
                className={cn(INPUT, 'min-w-40 flex-1')}
              />
              {flags.map((flag) => {
                const checked = 'id' in item && (item as DraftOption)[flag] === true;
                return (
                  <label
                    key={flag}
                    title={flagLabels[flag].hint}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        edit({
                          type: 'updateItem',
                          id: questionId,
                          list,
                          index,
                          patch: { [flag]: event.target.checked ? true : undefined },
                        });
                      }}
                      className="size-4 accent-primary"
                    />
                    {flagLabels[flag].label}
                  </label>
                );
              })}
              <span className="ml-auto flex">
                <button
                  type="button"
                  className={ICON_BUTTON}
                  disabled={index === 0}
                  aria-label={`${I.moveUp} (${position})`}
                  onClick={() => {
                    edit({ type: 'moveItem', id: questionId, list, from: index, to: index - 1 });
                  }}
                >
                  <ArrowUp aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  disabled={index === items.length - 1}
                  aria-label={`${I.moveDown} (${position})`}
                  onClick={() => {
                    edit({ type: 'moveItem', id: questionId, list, from: index, to: index + 1 });
                  }}
                >
                  <ArrowDown aria-hidden className="size-4" />
                </button>
                <button
                  type="button"
                  className={ICON_BUTTON}
                  aria-label={`${I.remove} (${position})`}
                  onClick={() => {
                    edit({ type: 'removeItem', id: questionId, list, index });
                  }}
                >
                  <X aria-hidden className="size-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            edit({
              type: 'addItem',
              id: questionId,
              list,
              item: { id: newId(), code: nextItemCode(items), label: '' },
            });
          }}
        >
          <Plus aria-hidden />
          {addLabel}
        </Button>
      </div>
    </fieldset>
  );
}
