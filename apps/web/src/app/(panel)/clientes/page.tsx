import { can, ClientListResponse } from '@az-pesquisas/contracts';
import { Building2 } from 'lucide-react';
import type { Metadata } from 'next';

import { Forbidden } from '@/components/forbidden';
import {
  DeleteClientButton,
  EditClientButton,
  NewClientButton,
} from '@/components/forms/client-dialogs';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { errorMessage, t } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';
import { formatTaxId } from '@/lib/format';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.clients.title };

const TH = 'px-5 py-3 text-left text-xs font-bold text-muted-foreground';
const WIDE = 'hidden md:table-cell';

export default async function ClientsPage() {
  const me = await currentUser();
  if (!can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const list = await apiGet('/v1/clients', ClientListResponse);
  if (!list.ok) {
    return (
      <Alert tone="error">{errorMessage(list.status === 403 ? 'FORBIDDEN' : undefined)}</Alert>
    );
  }
  const clients = list.data.items;

  return (
    <>
      <PageHeader title={t.clients.title} intro={t.clients.intro} action={<NewClientButton />} />
      {clients.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong p-12 text-center">
          <Building2 aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">{t.clients.empty}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t.clients.title}</caption>
              <thead className="border-b border-border bg-surface-sunken/60">
                <tr>
                  <th scope="col" className={TH}>
                    {t.clients.name}
                  </th>
                  <th scope="col" className={cn(TH, WIDE)}>
                    {t.clients.contact}
                  </th>
                  <th scope="col" className={cn(TH, 'text-right')}>
                    {t.clients.surveys}
                  </th>
                  <th scope="col" className={TH}>
                    <span className="sr-only">{t.common.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    data-testid="client-row"
                    className="transition-colors hover:bg-background/60"
                  >
                    <td className="px-5 py-3">
                      <p className="font-semibold">{client.name}</p>
                      {client.document ? (
                        <p className="font-mono text-xs tabular text-muted-foreground">
                          {formatTaxId(client.document)}
                        </p>
                      ) : null}
                    </td>
                    <td className={cn('px-5 py-3', WIDE)}>
                      {(client.contactName ?? client.contactEmail ?? client.contactPhone) ? (
                        <>
                          <p>{client.contactName}</p>
                          <p className="text-muted-foreground break-all">
                            {[client.contactEmail, client.contactPhone]
                              .filter((v) => v !== null)
                              .join(' · ')}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{t.common.none}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular">{client.surveyCount}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <EditClientButton client={client} />
                      <DeleteClientButton client={client} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span className="font-mono tabular">{clients.length}</span>{' '}
            {t.clients.count(clients.length)}
          </p>
        </div>
      )}
    </>
  );
}
