import { can, UserListResponse } from '@az-pesquisas/contracts';
import type { Metadata } from 'next';

import { Forbidden } from '@/components/forbidden';
import { NewUserButton, EditUserButton } from '@/components/forms/user-dialogs';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { errorMessage, t } from '@/i18n/pt-BR';
import { formatDateTime } from '@/lib/format';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.users.title };

export default async function UsersPage() {
  const me = await currentUser();
  if (!can(me.role, 'users.manage')) {
    return <Forbidden />;
  }
  const list = await apiGet('/v1/users', UserListResponse);
  if (!list.ok) {
    return (
      <Alert tone="error">{errorMessage(list.status === 403 ? 'FORBIDDEN' : undefined)}</Alert>
    );
  }

  return (
    <>
      <PageHeader title={t.users.title} intro={t.users.intro} action={<NewUserButton />} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{t.users.name}</th>
              <th className="px-4 py-3 font-medium">{t.users.email}</th>
              <th className="px-4 py-3 font-medium">{t.users.role}</th>
              <th className="px-4 py-3 font-medium">{t.users.status}</th>
              <th className="px-4 py-3 font-medium">{t.users.lastLogin}</th>
              <th className="px-4 py-3 font-medium">
                <span className="sr-only">{t.users.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.data.items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {t.users.empty}
                </td>
              </tr>
            ) : null}
            {list.data.items.map((user) => (
              <tr key={user.id} data-testid="user-row">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3">{t.roles[user.role]}</td>
                <td className="px-4 py-3">
                  <Badge tone={user.status === 'active' ? 'neutral' : 'muted'}>
                    {t.statuses[user.status]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDateTime(user.lastLoginAt, t.users.never)}
                </td>
                <td className="px-4 py-3 text-right">
                  <EditUserButton user={user} isSelf={user.id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
