'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const logout = async () => {
    setPending(true);
    await send('POST', '/api/auth/logout');
    window.location.assign('/login');
  };
  return (
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={() => {
        void logout();
      }}
      disabled={pending}
    >
      {t.nav.logout}
    </Button>
  );
}
