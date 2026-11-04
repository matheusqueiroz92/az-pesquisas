import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n/pt-BR';
import { navigationFor } from '@/lib/navigation';
import { currentUser } from '@/server/api-client';

export default async function HomePage() {
  const me = await currentUser();
  const shortcuts = navigationFor(me.role).filter((item) => item.href !== '/');
  return (
    <>
      <PageHeader title={t.home.greeting(me.name)} intro={t.home.intro} />
      <p className="mb-6 text-sm text-slate-600">
        {t.home.yourRole}: <strong>{t.roles[me.role]}</strong>
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="transition-colors hover:border-brand-600">
              <p className="font-medium">{item.label}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
