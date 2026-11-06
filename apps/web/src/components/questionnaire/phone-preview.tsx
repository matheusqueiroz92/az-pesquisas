import type { DraftQuestion } from '@az-pesquisas/contracts';
import { Camera, PenLine } from 'lucide-react';

import { t } from '@/i18n/pt-BR';

const P = t.questionnaire.preview;

const ChoiceRow = ({ label, square }: { label: string; square: boolean }) => (
  <div className="flex min-h-12 items-center gap-3 rounded-md border border-border-strong bg-surface px-3 text-sm">
    <span
      aria-hidden
      className={`size-5 shrink-0 border-2 border-border-strong ${square ? 'rounded-xs' : 'rounded-full'}`}
    />
    {label}
  </div>
);

function Answer({ question: q }: { question: DraftQuestion }) {
  switch (q.type) {
    case 'single_choice':
    case 'multiple_choice':
      return (
        <div className="flex flex-col gap-2">
          {q.options.map((o) => (
            <div key={o.id} className="flex flex-col gap-1">
              <ChoiceRow label={o.label || o.code} square={q.type === 'multiple_choice'} />
              {o.other ? (
                <div className="ml-8 h-9 rounded-sm border border-dashed border-border-strong px-2 text-xs leading-9 text-muted-foreground">
                  {P.other}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      );
    case 'text':
      return (
        <div
          className={`rounded-md border border-border-strong bg-surface p-3 text-sm text-muted-foreground ${q.multiline ? 'h-24' : 'h-12'}`}
        >
          {P.textPlaceholder}
        </div>
      );
    case 'number':
      return (
        <div className="flex h-12 items-center justify-between rounded-md border border-border-strong bg-surface px-3 text-sm text-muted-foreground">
          <span>
            {q.min !== undefined || q.max !== undefined
              ? `${String(q.min ?? '…')} – ${String(q.max ?? '…')}`
              : '123'}
          </span>
          {q.unit ? <span>{q.unit}</span> : null}
        </div>
      );
    case 'scale': {
      const points =
        q.max > q.min && q.max - q.min <= 100
          ? Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i)
          : [];
      return (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-6 gap-1.5">
            {points.map((n) => (
              <span
                key={n}
                className="grid h-10 place-items-center rounded-sm border border-border-strong bg-surface font-mono text-sm"
              >
                {n}
              </span>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{q.minLabel}</span>
            <span>{q.maxLabel}</span>
          </div>
        </div>
      );
    }
    case 'matrix':
      return (
        <div className="flex flex-col gap-3">
          {q.rows.map((row) => (
            <div key={row.id} className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold">{row.label || row.code}</p>
              <div className="flex flex-wrap gap-1.5">
                {q.options.map((o) => (
                  <span
                    key={o.id}
                    className="rounded-pill border border-border-strong bg-surface px-3 py-1 text-xs"
                  >
                    {o.label || o.code}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case 'ranking':
      return (
        <ol className="flex flex-col gap-2">
          {q.options.map((o, i) => (
            <li
              key={o.id}
              className="flex min-h-12 items-center gap-3 rounded-md border border-border-strong bg-surface px-3 text-sm"
            >
              <span className="font-mono text-muted-foreground">{i + 1}</span>
              {o.label || o.code}
            </li>
          ))}
        </ol>
      );
    case 'date':
      return (
        <div className="h-12 rounded-md border border-border-strong bg-surface px-3 text-sm leading-[3rem] text-muted-foreground">
          dd/mm/aaaa
        </div>
      );
    case 'photo':
      return (
        <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border-strong text-sm text-muted-foreground">
          <Camera aria-hidden className="size-6" />
          {P.photo}
        </div>
      );
    case 'signature':
      return (
        <div className="flex h-28 flex-col items-center justify-end gap-1 rounded-md border border-dashed border-border-strong pb-2 text-xs text-muted-foreground">
          <PenLine aria-hidden className="size-5" />
          {P.signature}
        </div>
      );
  }
}

/** The selected question as the interviewer sees it in the app (approximation). */
export function PhonePreview({ question }: { question: DraftQuestion | undefined }) {
  return (
    <aside aria-label={P.title} className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-bold">{P.title}</h2>
        <p className="text-xs text-muted-foreground">{P.hint}</p>
      </div>
      <div className="mx-auto w-full max-w-[19rem] rounded-[2rem] border-8 border-sidebar bg-sidebar shadow-card">
        <div
          data-testid="phone-preview"
          className="flex h-[34rem] flex-col overflow-hidden rounded-[1.4rem] bg-background"
        >
          {question ? (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                <p className="mb-1 font-mono text-xs text-muted-foreground">
                  {question.code}
                  {question.required ? ` · ${P.required}` : ''}
                </p>
                <p className="mb-3 text-lg leading-snug font-bold">{question.text || P.empty}</p>
                {question.helpText ? (
                  <p className="mb-3 rounded-sm bg-info-soft px-3 py-2 text-xs">
                    {question.helpText}
                  </p>
                ) : null}
                <Answer question={question} />
              </div>
              <div className="flex gap-2 border-t border-border bg-surface p-3">
                <span className="grid h-11 flex-1 place-items-center rounded-sm border border-border-strong text-sm font-semibold">
                  {P.back}
                </span>
                <span className="grid h-11 flex-1 place-items-center rounded-sm bg-primary text-sm font-semibold text-primary-foreground">
                  {P.next}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
