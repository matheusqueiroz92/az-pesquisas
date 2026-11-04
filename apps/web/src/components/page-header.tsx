import type { ReactNode } from 'react';

export function PageHeader({
  title,
  intro,
  action,
}: {
  title: string;
  intro?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {intro ? <p className="mt-1 text-sm text-slate-600">{intro}</p> : null}
      </div>
      {action}
    </div>
  );
}
