import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { t } from '@/i18n/pt-BR';

import './globals.css';

export const metadata: Metadata = {
  title: { default: t.app.name, template: `%s · ${t.app.name}` },
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every page renders per request: the CSP nonce (rule 14) only exists at request time.
  await connection();
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
