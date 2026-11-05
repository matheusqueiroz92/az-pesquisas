import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { t } from '@/i18n/pt-BR';
import { navigationFor } from '@/lib/navigation';
import { currentUser } from '@/server/api-client';

export default async function HomePage() {
  const me = await currentUser();
  const shortcuts = navigationFor(me.role).filter((item) => item.href !== '/');
  return (
    <>
      <header className="mb-10 max-w-2xl">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-display md:leading-[1.02]">
          {t.home.greeting(me.name)}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">{t.home.intro}</p>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.home.yourRole}:{' '}
          <strong className="font-semibold text-foreground">{t.roles[me.role]}</strong>
        </p>
      </header>

      <section aria-labelledby="shortcuts" className="mb-12">
        <h2 id="shortcuts" className="mb-4 text-sm font-bold text-muted-foreground">
          {t.home.shortcuts}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {shortcuts.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group relative rounded-md border border-border bg-surface p-6 shadow-card transition-colors hover:border-foreground"
            >
              <span className="flex items-center justify-between gap-4">
                <span className="text-lg font-bold tracking-tight">{item.label}</span>
                <ArrowUpRight
                  aria-hidden
                  className="size-5 text-muted-foreground transition-colors group-hover:text-primary"
                />
              </span>
              <span className="mt-2 block text-sm text-muted-foreground">
                {t.home.shortcutHints[item.href]}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="next" className="rounded-md bg-surface-sunken p-6 md:p-8">
        <h2 id="next" className="text-lg font-bold tracking-tight">
          {t.home.nextTitle}
        </h2>
        <ul className="mt-5 grid gap-6 md:grid-cols-3">
          {t.home.next.map((item) => (
            <li key={item.title} className="border-l-2 border-border-strong pl-4">
              <p className="font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
