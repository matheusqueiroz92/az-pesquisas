import { azSymbol } from '@az-pesquisas/design-tokens';

import { cn } from '@/lib/cn';

/** The AZ symbol (red by default, it takes the text color). Decorative unless labelled. */
export function AzSymbol({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox={azSymbol.viewBox}
      fill="currentColor"
      className={cn('text-az-red-500', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path fillRule="evenodd" d={azSymbol.path} />
    </svg>
  );
}

/** Lockup: AZ symbol + "Pesquisas" (spec 012, decision 2). */
export function BrandLockup({
  tone = 'dark',
  className,
}: {
  tone?: 'dark' | 'light';
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <AzSymbol className="h-7 w-auto" title="AZ" />
      <span
        className={cn(
          'text-lg font-extrabold tracking-tight',
          tone === 'dark' ? 'text-sidebar-foreground' : 'text-foreground',
        )}
      >
        Pesquisas
      </span>
    </span>
  );
}
