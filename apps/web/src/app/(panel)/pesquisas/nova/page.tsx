import { can, ClientListResponse } from '@az-pesquisas/contracts';
import type { Metadata } from 'next';

import { BackLink } from '@/components/back-link';
import { Forbidden } from '@/components/forbidden';
import { SurveyForm } from '@/components/forms/survey-form';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { errorMessage, t } from '@/i18n/pt-BR';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.surveys.new };

export default async function NewSurveyPage() {
  const me = await currentUser();
  if (!can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const clients = await apiGet('/v1/clients', ClientListResponse);
  if (!clients.ok) {
    return <Alert tone="error">{errorMessage(undefined)}</Alert>;
  }
  return (
    <>
      <BackLink href="/pesquisas" label={t.surveys.back} />
      <PageHeader title={t.surveys.new} />
      <SurveyForm clients={clients.data.items} />
    </>
  );
}
