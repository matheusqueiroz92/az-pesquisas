import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

const TONES = {
  error: { box: 'bg-error-soft text-error-foreground border-error/25', Icon: CircleAlert },
  success: { box: 'bg-success-soft text-success-foreground border-success/25', Icon: CircleCheck },
  info: { box: 'bg-info-soft text-foreground border-info/20', Icon: Info },
} as const;

/** Status is never color alone: every tone carries an icon (spec 012). */
export function Alert({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-sm border px-3.5 py-3 text-sm', box)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
