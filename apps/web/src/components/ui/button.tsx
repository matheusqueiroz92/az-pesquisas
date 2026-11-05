import type { ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const VARIANTS = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover disabled:bg-primary/50 shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]',
  secondary: 'border border-border-strong bg-surface text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'bg-error text-white hover:bg-error-foreground',
} as const;

const SIZES = {
  md: 'h-touch px-5 text-sm',
  sm: 'h-9 px-3 text-sm',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: keyof typeof VARIANTS;
  readonly size?: keyof typeof SIZES;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-semibold whitespace-nowrap transition-colors duration-150 active:translate-y-px disabled:cursor-not-allowed [&_svg]:size-4',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
