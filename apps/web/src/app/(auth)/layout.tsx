import type { ReactNode } from 'react';

import { AzSymbol, BrandLockup } from '@/components/brand';
import { t } from '@/i18n/pt-BR';

/**
 * Login and password screens. Large screens: a dark brand field on the left,
 * crossed by the red "linha AZ" that leads to the form (drawn once, spec 012).
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(28rem,1fr)]">
      <section
        aria-hidden
        className="relative hidden overflow-hidden bg-az-ink-950 text-az-paper-50 lg:flex lg:flex-col lg:justify-between lg:p-14"
      >
        <AzSymbol className="h-24 w-auto self-start" />
        <svg
          viewBox="0 0 600 400"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 top-[9%] h-[31%] w-full"
        >
          <path
            className="az-line"
            pathLength={1}
            d="M 170 4 C 330 12, 420 120, 480 230 S 570 392, 600 398"
            fill="none"
            stroke="var(--color-az-red-500)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="relative max-w-md">
          <p className="font-serif text-4xl leading-[1.12] font-normal tracking-tight">
            {t.app.manifesto}
          </p>
          <p className="mt-5 text-base leading-relaxed text-az-mist-400">{t.app.manifestoDetail}</p>
        </div>
        <p className="relative text-sm text-az-mist-400">{t.app.byline}</p>
      </section>

      <main className="flex min-h-dvh flex-col px-6 py-10 sm:px-12 lg:min-h-0 lg:justify-center lg:px-16">
        <div className="mb-12 rounded-md bg-sidebar px-4 py-3 lg:hidden">
          <BrandLockup />
        </div>
        <div className="mx-auto w-full max-w-sm lg:mx-0">{children}</div>
        <p className="mt-auto pt-12 text-xs text-muted-foreground lg:hidden">{t.app.byline}</p>
      </main>
    </div>
  );
}
