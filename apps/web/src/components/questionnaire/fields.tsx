'use client';

import { useId } from 'react';

import { TextField } from '@/components/ui/field';

const AREA =
  'w-full rounded-sm border border-border-strong bg-surface px-3.5 py-2.5 text-base text-foreground hover:border-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30 disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-error';

export function CheckboxField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="mt-0.5 size-4 accent-primary"
      />
      <span>
        <span className="font-semibold">{label}</span>
        {hint ? <span className="block text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  value,
  onChange,
  maxLength,
  rows = 3,
  invalid = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
  invalid?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={AREA}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A number input whose empty value means "not set" (undefined). */
export function OptionalNumberField({
  label,
  hint,
  value,
  onChange,
  integer = false,
  min,
  max,
  invalid = false,
}: {
  label: string;
  hint?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  integer?: boolean;
  min?: number;
  max?: number;
  invalid?: boolean;
}) {
  return (
    <TextField
      label={label}
      {...(hint ? { hint } : {})}
      type="number"
      inputMode={integer ? 'numeric' : 'decimal'}
      step={integer ? 1 : 'any'}
      {...(min === undefined ? {} : { min })}
      {...(max === undefined ? {} : { max })}
      value={value ?? ''}
      invalid={invalid}
      onChange={(event) => {
        const text = event.target.value;
        const number = Number(text);
        onChange(text === '' || !Number.isFinite(number) ? undefined : number);
      }}
    />
  );
}
