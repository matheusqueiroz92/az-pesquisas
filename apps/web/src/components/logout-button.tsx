'use client';

import { LogOut } from 'lucide-react';
import { useState } from 'react';

import { t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false);
  const logout = async () => {
    setPending(true);
    await send('POST', '/api/auth/logout');
    window.location.assign('/login');
  };
  if (compact) {
    return (
      <button
        type="button"
        onClick={() => {
          void logout();
        }}
        disabled={pending}
        aria-label={t.nav.logout}
        className="grid size-11 place-items-center rounded-sm text-sidebar-muted-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground"
      >
        <LogOut aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        void logout();
      }}
      disabled={pending}
      className="flex h-11 w-full items-center gap-3 rounded-sm px-3 text-sm font-semibold text-sidebar-muted-foreground transition-colors hover:bg-sidebar-hover hover:text-sidebar-foreground disabled:opacity-60"
    >
      <LogOut aria-hidden className="size-[18px]" strokeWidth={1.75} />
      {t.nav.logout}
    </button>
  );
}
