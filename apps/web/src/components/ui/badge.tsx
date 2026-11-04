import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'muted';
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' ? 'bg-brand-50 text-brand-900' : 'bg-slate-200 text-slate-600',
      )}
    >
      {children}
    </span>
  );
}
