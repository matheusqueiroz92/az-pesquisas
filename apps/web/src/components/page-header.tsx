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
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-border pb-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {intro ? <p className="mt-2 text-base text-muted-foreground">{intro}</p> : null}
      </div>
      {action}
    </header>
  );
}
