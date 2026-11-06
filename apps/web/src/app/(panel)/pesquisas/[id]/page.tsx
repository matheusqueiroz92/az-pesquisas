import { can, ClientListResponse, Id, SurveyView } from '@az-pesquisas/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { Forbidden } from '@/components/forbidden';
import { SurveyActions } from '@/components/forms/survey-actions';
import { SurveyForm } from '@/components/forms/survey-form';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { errorMessage, t } from '@/i18n/pt-BR';
import { formatDateTime } from '@/lib/format';
import { STATUS_TONE } from '@/lib/surveys';
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
      <BackLink href="/pesquisas" label={t.surveys.back} />
      <header className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-border pb-6">
        <div className="max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge tone={STATUS_TONE[s.status]}>{t.surveyStatuses[s.status]}</StatusBadge>
            <span>{t.surveyTypes[s.type]}</span>
            <span aria-hidden>·</span>
            <span>{s.clientName ?? t.surveys.ownSurvey}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{s.title}</h1>
          <p className="mt-2 font-mono text-xs tabular text-muted-foreground">
            {t.surveys.updatedAt} {formatDateTime(s.updatedAt)}
          </p>
        </div>
        <SurveyActions survey={s} />
      </header>
      {/* key: opening another survey (e.g. a duplicate) starts a fresh form. */}
      <SurveyForm key={s.id} survey={s} clients={clients.data.items} />
    </>
  );
}
