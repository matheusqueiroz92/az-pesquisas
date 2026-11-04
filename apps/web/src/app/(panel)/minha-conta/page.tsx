import type { Metadata } from 'next';

import { ChangePasswordForm } from '@/components/forms/change-password-form';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n/pt-BR';
import { currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.account.title };

export default async function AccountPage() {
  const me = await currentUser();
  return (
    <>
      <PageHeader title={t.account.title} />
      <div className="grid max-w-3xl gap-6">
        <Card>
          <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-slate-500">{t.users.name}</dt>
            <dd>{me.name}</dd>
            <dt className="text-slate-500">{t.users.email}</dt>
            <dd>{me.email}</dd>
            <dt className="text-slate-500">{t.users.role}</dt>
            <dd>{t.roles[me.role]}</dd>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">{t.account.changePassword}</h2>
          <ChangePasswordForm />
        </Card>
      </div>
    </>
  );
}
