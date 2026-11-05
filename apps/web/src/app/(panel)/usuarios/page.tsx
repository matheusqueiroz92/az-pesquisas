import { can, UserListResponse } from '@az-pesquisas/contracts';
import { UsersRound } from 'lucide-react';
import type { Metadata } from 'next';

import { Forbidden } from '@/components/forbidden';
import { EditUserButton, NewUserButton } from '@/components/forms/user-dialogs';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { errorMessage, t } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { initials } from '@/lib/initials';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.users.title };

const TH = 'px-5 py-3 text-left text-xs font-bold text-muted-foreground';
// Small screens keep name and action; role and status move under the name.
const WIDE = 'hidden md:table-cell';

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
  const users = list.data.items;

  return (
    <>
      <PageHeader title={t.users.title} intro={t.users.intro} action={<NewUserButton />} />
      {users.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong p-12 text-center">
          <UsersRound aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">{t.users.empty}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t.users.title}</caption>
              <thead className="border-b border-border bg-surface-sunken/60">
                <tr>
                  <th scope="col" className={TH}>
                    {t.users.name}
                  </th>
                  <th scope="col" className={cn(TH, WIDE)}>
                    {t.users.role}
                  </th>
                  <th scope="col" className={cn(TH, WIDE)}>
                    {t.users.status}
                  </th>
                  <th scope="col" className={cn(TH, WIDE)}>
                    {t.users.lastLogin}
                  </th>
                  <th scope="col" className={TH}>
                    <span className="sr-only">{t.users.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    data-testid="user-row"
                    className="transition-colors hover:bg-background/60"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="grid size-9 shrink-0 place-items-center rounded-pill bg-muted text-xs font-bold text-muted-foreground"
                        >
                          {initials(user.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{user.name}</p>
                          <p className="text-muted-foreground break-all md:truncate">
                            {user.email}
                          </p>
                          <p className="mt-1.5 flex flex-wrap items-center gap-2 md:hidden">
                            <span>{t.roles[user.role]}</span>
                            <StatusBadge tone={user.status === 'active' ? 'success' : 'neutral'}>
                              {t.statuses[user.status]}
                            </StatusBadge>
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={cn('px-5 py-3', WIDE)}>{t.roles[user.role]}</td>
                    <td className={cn('px-5 py-3', WIDE)}>
                      <StatusBadge tone={user.status === 'active' ? 'success' : 'neutral'}>
                        {t.statuses[user.status]}
                      </StatusBadge>
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3 font-mono text-xs font-medium tabular text-muted-foreground',
                        WIDE,
                      )}
                    >
                      {formatDateTime(user.lastLoginAt, t.users.never)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <EditUserButton user={user} isSelf={user.id === me.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span className="font-mono tabular">{users.length}</span>{' '}
            {users.length === 1 ? 'usuário' : 'usuários'}
          </p>
        </div>
      )}
    </>
  );
}
