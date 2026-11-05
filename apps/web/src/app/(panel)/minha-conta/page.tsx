import type { Metadata } from 'next';

import { ChangePasswordForm } from '@/components/forms/change-password-form';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n/pt-BR';
import { initials } from '@/lib/initials';
import { currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.account.title };

export default async function AccountPage() {
  const me = await currentUser();
  return (
    <>
      <PageHeader title={t.account.title} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
        <Card>
          <span
            aria-hidden
            className="grid size-14 place-items-center rounded-pill bg-sidebar text-lg font-bold text-sidebar-foreground"
          >
            {initials(me.name)}
          </span>
          <dl className="mt-5 grid gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{t.users.name}</dt>
              <dd className="mt-0.5 font-semibold">{me.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.users.email}</dt>
              <dd className="mt-0.5 font-semibold break-all">{me.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t.users.role}</dt>
              <dd className="mt-0.5 font-semibold">{t.roles[me.role]}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-5 text-lg font-bold tracking-tight">{t.account.changePassword}</h2>
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
