'use client';

import type { DraftQuestion, LintIssue } from '@az-pesquisas/contracts';
import { Copy, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { t } from '@/i18n/pt-BR';
import type { EditorAction, NewId } from '@/lib/questionnaire-editor';

import { ConditionEditor } from './condition-editor';
import { CheckboxField, OptionalNumberField, TextAreaField } from './fields';
import { ItemsEditor } from './items-editor';

const F = t.questionnaire.fields;
const I = t.questionnaire.items;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5">
      <h3 className="text-sm font-bold tracking-tight text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

const SCALE_PRESETS = [
  { label: '0 a 10', min: 0, max: 10 },
  { label: '1 a 5', min: 1, max: 5 },
  { label: '1 a 10', min: 1, max: 10 },
] as const;

/** Type-specific settings (spec 014 rule 3). */
function TypeSettings({
  question: q,
  invalid,
  update,
}: {
  question: DraftQuestion;
  invalid: (code: LintIssue['code']) => boolean;
  update: (patch: Partial<DraftQuestion>) => void;
}) {
  switch (q.type) {
    case 'single_choice':
    case 'multiple_choice':
      return (
        <div className="flex flex-col gap-4">
          <CheckboxField
            label={F.shuffle}
            hint={F.shuffleHint}
            checked={q.shuffleOptions}
            onChange={(shuffleOptions) => {
              update({ shuffleOptions });
            }}
          />
          {q.type === 'multiple_choice' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <OptionalNumberField
                label={F.minSelections}
                integer
                min={0}
                value={q.minSelections}
                invalid={invalid('SELECTIONS_RANGE')}
                onChange={(value) => {
                  update({ minSelections: value ?? 0 });
                }}
              />
              <OptionalNumberField
                label={F.maxSelections}
                hint={F.noLimit}
                integer
                min={1}
                value={q.maxSelections}
                invalid={invalid('SELECTIONS_RANGE')}
                onChange={(maxSelections) => {
                  update({ maxSelections });
                }}
              />
            </div>
          ) : null}
        </div>
      );
    case 'text':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <CheckboxField
            label={F.multiline}
            checked={q.multiline}
            onChange={(multiline) => {
              update({ multiline });
            }}
          />
          <OptionalNumberField
            label={F.maxLength}
            integer
            min={1}
            max={5000}
            value={q.maxLength}
            onChange={(value) => {
              update({ maxLength: value ?? 500 });
            }}
          />
        </div>
      );
    case 'number':
      return (
        <div className="flex flex-col gap-4">
          <CheckboxField
            label={F.integer}
            checked={q.integer}
            onChange={(integer) => {
              update({ integer });
            }}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <OptionalNumberField
              label={F.min}
              value={q.min}
              integer={q.integer}
              invalid={invalid('NUMBER_RANGE')}
              onChange={(min) => {
                update({ min });
              }}
            />
            <OptionalNumberField
              label={F.max}
              value={q.max}
              integer={q.integer}
              invalid={invalid('NUMBER_RANGE')}
              onChange={(max) => {
                update({ max });
              }}
            />
            <TextField
              label={F.unit}
              hint={F.unitHint}
              maxLength={20}
              value={q.unit ?? ''}
              onChange={(event) => {
                update({ unit: event.target.value === '' ? undefined : event.target.value });
              }}
            />
          </div>
        </div>
      );
    case 'scale':
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{F.presets}:</span>
            {SCALE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="secondary"
                size="sm"
                onClick={() => {
                  update({ min: preset.min, max: preset.max });
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <OptionalNumberField
              label={F.scaleFrom}
              integer
              value={q.min}
              invalid={invalid('SCALE_RANGE')}
              onChange={(value) => {
                update({ min: value ?? 0 });
              }}
            />
            <OptionalNumberField
              label={F.scaleTo}
              integer
              value={q.max}
              invalid={invalid('SCALE_RANGE')}
              onChange={(value) => {
                update({ max: value ?? 0 });
              }}
            />
            <TextField
              label={F.minLabel}
              maxLength={60}
              value={q.minLabel ?? ''}
              onChange={(event) => {
                update({ minLabel: event.target.value === '' ? undefined : event.target.value });
              }}
            />
            <TextField
              label={F.maxLabel}
              maxLength={60}
              value={q.maxLabel ?? ''}
              onChange={(event) => {
                update({ maxLabel: event.target.value === '' ? undefined : event.target.value });
              }}
            />
          </div>
        </div>
      );
    case 'ranking':
      return (
        <OptionalNumberField
          label={F.maxRanked}
          hint={F.maxRankedAll}
          integer
          min={1}
          value={q.maxRanked}
          invalid={invalid('RANKED_TOO_MANY')}
          onChange={(maxRanked) => {
            update({ maxRanked });
          }}
        />
      );
    case 'date':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={F.minDate}
            type="date"
            value={q.min ?? ''}
            invalid={invalid('DATE_RANGE')}
            onChange={(event) => {
              update({ min: event.target.value === '' ? undefined : event.target.value });
            }}
          />
          <TextField
            label={F.maxDate}
            type="date"
            value={q.max ?? ''}
            invalid={invalid('DATE_RANGE')}
            onChange={(event) => {
              update({ max: event.target.value === '' ? undefined : event.target.value });
            }}
          />
        </div>
      );
    case 'photo':
      return (
        <SelectField
          label={F.maxPhotos}
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
          value={String(q.maxPhotos)}
          onChange={(event) => {
            update({ maxPhotos: Number(event.target.value) });
          }}
        />
      );
    case 'matrix':
    case 'signature':
      return null;
  }
}

/** The form of the selected question (spec 014). */
export function QuestionForm({
  question: q,
  earlier,
  issues,
  newId,
  edit,
  onDuplicate,
  onRemove,
}: {
  question: DraftQuestion;
  earlier: readonly DraftQuestion[];
  issues: readonly LintIssue[];
  newId: NewId;
  edit: (action: EditorAction) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const update = (patch: Partial<DraftQuestion>) => {
    edit({ type: 'update', id: q.id, patch });
  };
  const invalid = (code: LintIssue['code']) => issues.some((i) => i.code === code);
  const invalidItems = (list: 'options' | 'rows') =>
    new Set(issues.filter((i) => i.list === list && i.item !== undefined).map((i) => i.item ?? -1));
  const optionFlags =
    q.type === 'multiple_choice'
      ? (['fixed', 'exclusive', 'other'] as const)
      : q.type === 'single_choice'
        ? (['fixed', 'other'] as const)
        : ([] as const);

  return (
    <Card>
      <div className="flex flex-col gap-5" data-testid="question-form">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground">{t.questionTypes[q.type]}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              <Copy aria-hidden />
              {t.questionnaire.duplicate}
            </Button>
            <Button variant="ghost" size="sm" onClick={onRemove}>
              <Trash2 aria-hidden />
              {t.questionnaire.remove}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <TextField
            label={F.code}
            value={q.code}
            maxLength={40}
            className="font-mono"
            invalid={invalid('CODE_INVALID') || invalid('CODE_REPEATED')}
            onChange={(event) => {
              update({ code: event.target.value.toUpperCase().replace(/\s/g, '_') });
            }}
          />
          <div className="flex items-end pb-3">
            <CheckboxField
              label={F.required}
              checked={q.required}
              onChange={(required) => {
                update({ required });
              }}
            />
          </div>
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">{F.codeHint}</p>

        <TextAreaField
          label={F.text}
          value={q.text}
          maxLength={1000}
          rows={2}
          invalid={invalid('TEXT_EMPTY')}
          onChange={(text) => {
            update({ text });
          }}
        />
        <TextAreaField
          label={F.helpText}
          hint={F.helpTextHint}
          value={q.helpText ?? ''}
          maxLength={1000}
          rows={2}
          onChange={(helpText) => {
            update({ helpText: helpText === '' ? undefined : helpText });
          }}
        />

        {q.type === 'matrix' ? (
          <>
            <ItemsEditor
              questionId={q.id}
              list="rows"
              title={I.rows}
              addLabel={I.addRow}
              items={q.rows}
              flags={[]}
              invalidItems={invalidItems('rows')}
              newId={newId}
              edit={edit}
            />
            <ItemsEditor
              questionId={q.id}
              list="options"
              title={I.columns}
              addLabel={I.addColumn}
              items={q.options}
              flags={[]}
              invalidItems={invalidItems('options')}
              newId={newId}
              edit={edit}
            />
          </>
        ) : 'options' in q ? (
          <ItemsEditor
            questionId={q.id}
            list="options"
            title={I.options}
            addLabel={I.add}
            items={q.options}
            flags={optionFlags}
            invalidItems={invalidItems('options')}
            newId={newId}
            edit={edit}
          />
        ) : null}

        <TypeSettings question={q} invalid={invalid} update={update} />

        <Section title={t.questionnaire.condition.title}>
          <ConditionEditor question={q} earlier={earlier} edit={edit} />
        </Section>
      </div>
    </Card>
  );
}
