import type { ReactNode } from 'react';

import { LogoutButton } from '@/components/logout-button';
import { NavLinks } from '@/components/nav-links';
import { t } from '@/i18n/pt-BR';
import { navigationFor } from '@/lib/navigation';
import { currentUser } from '@/server/api-client';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const me = await currentUser();
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-slate-200 bg-white p-4 md:w-60 md:border-r md:border-b-0">
        <p className="px-3 text-lg font-semibold text-brand-900">{t.app.name}</p>
        <nav aria-label="Menu principal" className="flex-1">
          <NavLinks items={navigationFor(me.role)} />
        </nav>
        <div className="border-t border-slate-200 pt-4">
          <p className="truncate px-3 text-sm font-medium" data-testid="current-user">
            {me.name}
          </p>
          <p className="truncate px-3 text-xs text-slate-500">{t.roles[me.role]}</p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
