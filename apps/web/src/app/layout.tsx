import type { Metadata } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import '@fontsource-variable/manrope';
import '@fontsource-variable/newsreader';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

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
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
