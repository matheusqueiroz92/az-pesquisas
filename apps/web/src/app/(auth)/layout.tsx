import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { t } from '@/i18n/pt-BR';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xl font-semibold text-brand-900">{t.app.name}</p>
          <p className="text-sm text-slate-500">{t.app.tagline}</p>
        </div>
        <Card>{children}</Card>
      </div>
    </main>
  );
}
