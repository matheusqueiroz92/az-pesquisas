import type { ReactNode } from 'react';

import { BrandLockup } from '@/components/brand';
import { LogoutButton } from '@/components/logout-button';
import { NavLinks } from '@/components/nav-links';
import { t } from '@/i18n/pt-BR';
import { initials } from '@/lib/initials';
import { navigationFor } from '@/lib/navigation';
import { currentUser } from '@/server/api-client';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const me = await currentUser();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr] print:block">
      <aside className="flex flex-col bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:h-dvh print:hidden">
        <div className="flex h-16 items-center justify-between px-5 md:h-20">
          <BrandLockup />
          <div className="md:hidden">
            <LogoutButton compact />
          </div>
        </div>
        <nav
          aria-label="Menu principal"
          className="overflow-x-auto border-y border-sidebar-border px-3 py-2 md:flex-1 md:border-y-0 md:py-4"
        >
          <NavLinks items={navigationFor(me.role)} />
        </nav>
        <div className="hidden border-t border-sidebar-border p-3 md:block">
          <div className="flex items-center gap-3 px-2 py-2">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-pill bg-sidebar-hover text-xs font-bold text-sidebar-foreground ring-1 ring-sidebar-border"
            >
              {initials(me.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" data-testid="current-user">
                {me.name}
              </p>
              <p className="truncate text-xs text-sidebar-muted-foreground">{t.roles[me.role]}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-10 md:py-12 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
