import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const CONTROL =
  'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-xs placeholder:text-slate-400 aria-invalid:border-red-500';

interface FieldShellProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly id: string;
  readonly children: ReactNode;
}

function FieldShell({ label, hint, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly hint?: string;
  readonly invalid?: boolean;
}

export function TextField({ label, hint, invalid, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <input
        id={id}
        aria-invalid={invalid === true ? true : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, className)}
        {...props}
      />
    </FieldShell>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  readonly label: string;
  readonly options: readonly { value: string; label: string }[];
}

export function SelectField({ label, options, className, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} id={id}>
      <select id={id} className={cn(CONTROL, className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
