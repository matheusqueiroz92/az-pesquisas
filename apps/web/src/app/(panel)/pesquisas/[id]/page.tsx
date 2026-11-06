import { can, ClientListResponse, Id, SurveyView } from '@az-pesquisas/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Forbidden } from '@/components/forbidden';
import { SurveyActions } from '@/components/forms/survey-actions';
import { SurveyForm } from '@/components/forms/survey-form';
import { SurveyHeader } from '@/components/survey-header';
import { Alert } from '@/components/ui/alert';
import { errorMessage, t } from '@/i18n/pt-BR';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.surveys.survey };

export default async function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const { id } = await params;
  if (!Id.safeParse(id).success) {
    notFound();
  }
  const [survey, clients] = await Promise.all([
    apiGet(`/v1/surveys/${id}`, SurveyView),
    apiGet('/v1/clients', ClientListResponse),
  ]);
  if (!survey.ok && survey.status === 404) {
    notFound();
  }
  if (!survey.ok || !clients.ok) {
    return <Alert tone="error">{errorMessage(undefined)}</Alert>;
  }
  const s = survey.data;

  return (
    <>
      <SurveyHeader survey={s} current="survey" actions={<SurveyActions survey={s} />} />
      {/* key: opening another survey (e.g. a duplicate) starts a fresh form. */}
      <SurveyForm key={s.id} survey={s} clients={clients.data.items} />
    </>
  );
}
