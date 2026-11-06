import { can, DeviceListResponse } from '@az-pesquisas/contracts';
import { Tablet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Forbidden } from '@/components/forbidden';
import {
  PairDeviceButton,
  RenameDeviceButton,
  RevokeDeviceButton,
} from '@/components/forms/device-dialogs';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { errorMessage, t } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.devices.title };

const D = t.devices;
const TH = 'px-5 py-3 text-left text-xs font-bold text-muted-foreground';
const WIDE = 'hidden lg:table-cell';

export default async function DevicesPage() {
  const me = await currentUser();
  if (!can(me.role, 'devices.manage')) {
    return <Forbidden />;
  }
  const list = await apiGet('/v1/devices', DeviceListResponse);
  if (!list.ok) {
    return <Alert tone="error">{errorMessage(undefined)}</Alert>;
  }
  const devices = list.data.items;

  return (
    <>
      <PageHeader title={D.title} intro={D.intro} action={<PairDeviceButton />} />
      {devices.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong p-12 text-center">
          <Tablet aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">{D.empty}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{D.title}</caption>
              <thead className="border-b border-border bg-surface-sunken/60">
                <tr>
                  <th scope="col" className={TH}>
                    {D.device}
                  </th>
                  <th scope="col" className={cn(TH, 'hidden md:table-cell')}>
                    {D.lastSeen}
                  </th>
                  <th scope="col" className={cn(TH, WIDE)}>
                    {D.surveys}
                  </th>
                  <th scope="col" className={TH}>
                    <span className="sr-only">{t.common.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {devices.map((device) => {
                  const active = device.status === 'active';
                  return (
                    <tr
                      key={device.id}
                      data-testid="device-row"
                      className={cn(!active && 'opacity-70')}
                    >
                      <td className="px-5 py-3">
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {device.nickname}
                          <StatusBadge tone={active ? 'success' : 'neutral'}>
                            {active ? D.active : D.revoked}
                          </StatusBadge>
                        </p>
                        <p className="text-muted-foreground">
                          {device.model} · {D.platform[device.platform]} {device.osVersion} ·{' '}
                          {D.app} {device.appVersion}
                        </p>
                        <p className="font-mono text-xs tabular text-muted-foreground">
                          {D.pairedAt} {formatDateTime(device.pairedAt)}
                        </p>
                      </td>
                      <td className="hidden px-5 py-3 font-mono text-xs tabular md:table-cell">
                        {formatDateTime(device.lastSeenAt)}
                      </td>
                      <td className={cn('px-5 py-3', WIDE)}>
                        {device.surveys.length === 0 ? (
                          <span className="text-muted-foreground">{D.noSurveys}</span>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {device.surveys.map((s) => (
                              <li key={s.id}>
                                <Link
                                  href={`/pesquisas/${s.id}/equipe`}
                                  className="hover:text-link"
                                >
                                  {s.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {active ? (
                          <>
                            <RenameDeviceButton device={device} />
                            <RevokeDeviceButton device={device} />
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span className="font-mono tabular">{devices.length}</span> {D.count(devices.length)}
          </p>
        </div>
      )}
    </>
  );
}
