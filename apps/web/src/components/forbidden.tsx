import { Lock } from 'lucide-react';

import { t } from '@/i18n/pt-BR';

/** Rule 12: the page says so; the API refuses the data anyway. */
export function Forbidden() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-pill bg-muted text-muted-foreground">
        <Lock aria-hidden className="size-5" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{t.forbidden.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.forbidden.body}</p>
    </div>
  );
}
