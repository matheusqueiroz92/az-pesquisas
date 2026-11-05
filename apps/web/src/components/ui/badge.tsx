import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

const TONES = {
  success: { pill: 'bg-success-soft text-success-foreground', dot: 'bg-success' },
  neutral: { pill: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' },
} as const;

/** Status pill: dot + text, so the meaning never depends on color alone. */
export function StatusBadge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone].pill,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-pill', TONES[tone].dot)} />
      {children}
    </span>
  );
}
