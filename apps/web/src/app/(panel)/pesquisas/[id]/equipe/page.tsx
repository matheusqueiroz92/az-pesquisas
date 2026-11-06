import { can, Id, SurveyTeamView, SurveyView } from '@az-pesquisas/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Forbidden } from '@/components/forbidden';
import { TeamForm } from '@/components/forms/team-form';
import { SurveyHeader } from '@/components/survey-header';
import { Alert } from '@/components/ui/alert';
import { errorMessage, t } from '@/i18n/pt-BR';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.team.tab };

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!can(me.role, 'devices.manage') || !can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const { id } = await params;
  if (!Id.safeParse(id).success) {
    notFound();
  }
  const [survey, team] = await Promise.all([
    apiGet(`/v1/surveys/${id}`, SurveyView),
    apiGet(`/v1/surveys/${id}/team`, SurveyTeamView),
  ]);
  if (!survey.ok && survey.status === 404) {
    notFound();
  }
  if (!survey.ok || !team.ok) {
    return <Alert tone="error">{errorMessage(undefined)}</Alert>;
  }
  const locked = survey.data.status === 'closed' || survey.data.status === 'archived';
  return (
    <>
      <SurveyHeader survey={survey.data} current="team" />
      <TeamForm key={survey.data.updatedAt} surveyId={id} team={team.data} locked={locked} />
    </>
  );
}
