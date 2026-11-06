'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DraftQuestion } from '@az-pesquisas/contracts';
import { ArrowDown, ArrowUp, GitBranch, GripVertical } from 'lucide-react';
import { useId } from 'react';

import { t } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';

const Q = t.questionnaire;
const ICON_BUTTON =
  'grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30';

function Row({
  question,
  index,
  count,
  selected,
  issueCount,
  readOnly,
  onSelect,
  onMove,
}: {
  question: DraftQuestion;
  index: number;
  count: number;
  selected: boolean;
  issueCount: number;
  readOnly: boolean;
  onSelect: () => void;
  onMove: (to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: readOnly,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="question-row"
      className={cn(
        'group flex items-stretch gap-1 rounded-sm border bg-surface',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
        isDragging && 'z-10 shadow-card',
      )}
    >
      {readOnly ? null : (
        <button
          type="button"
          aria-label={Q.drag(question.code)}
          className="grid w-6 shrink-0 cursor-grab place-items-center text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn('min-w-0 flex-1 py-2 text-left', readOnly && 'pl-3')}
      >
        <span className="flex items-center gap-2">
          <span data-testid="question-code" className="font-mono text-xs font-semibold">
            {question.code || '—'}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {t.questionTypes[question.type]}
          </span>
          {question.visibleIf ? (
            <GitBranch aria-label={Q.conditional} className="size-3.5 text-info" />
          ) : null}
          {issueCount > 0 ? (
            <span
              className="ml-auto mr-1 rounded-pill bg-warning-soft px-1.5 font-mono text-xs font-semibold text-warning-foreground"
              aria-label={Q.issues.title(issueCount)}
            >
              {issueCount}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm">
          {question.text || <span className="text-muted-foreground">{Q.untitled}</span>}
        </span>
      </button>
      {readOnly ? null : (
        <span className="flex flex-col justify-center pr-1">
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={index === 0}
            aria-label={Q.moveUp(question.code)}
            onClick={() => {
              onMove(index - 1);
            }}
          >
            <ArrowUp aria-hidden className="size-3.5" />
          </button>
          <button
            type="button"
            className={ICON_BUTTON}
            disabled={index === count - 1}
            aria-label={Q.moveDown(question.code)}
            onClick={() => {
              onMove(index + 1);
            }}
          >
            <ArrowDown aria-hidden className="size-3.5" />
          </button>
        </span>
      )}
    </li>
  );
}

/** Ordered list of questions, sortable by drag and drop, keyboard or buttons (CA-02). */
export function QuestionList({
  questions,
  selectedId,
  issueCounts,
  readOnly,
  onSelect,
  onMove,
}: {
  questions: readonly DraftQuestion[];
  selectedId: string | undefined;
  issueCounts: ReadonlyMap<string, number>;
  readOnly: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, to: number) => void;
}) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const to = questions.findIndex((q) => q.id === over.id);
      onMove(String(active.id), to);
    }
  };
  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2" aria-label={Q.title}>
          {questions.map((question, index) => (
            <Row
              key={question.id}
              question={question}
              index={index}
              count={questions.length}
              selected={question.id === selectedId}
              issueCount={issueCounts.get(question.id) ?? 0}
              readOnly={readOnly}
              onSelect={() => {
                onSelect(question.id);
              }}
              onMove={(to) => {
                onMove(question.id, to);
              }}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
