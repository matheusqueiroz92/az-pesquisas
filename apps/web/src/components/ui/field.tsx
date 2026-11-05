import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const CONTROL =
  'h-touch w-full rounded-sm border border-border-strong bg-surface px-3.5 text-base text-foreground transition-colors placeholder:text-muted-foreground hover:border-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-error';

interface FieldShellProps {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly id: string;
  readonly children: ReactNode;
}

function FieldShell({ label, hint, id, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
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
      <div className="relative">
        <select id={id} className={cn(CONTROL, 'appearance-none pr-10', className)} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </FieldShell>
  );
}
