import { can, Id, QuestionnaireView, SurveyView } from '@az-pesquisas/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Forbidden } from '@/components/forbidden';
import { QuestionnaireEditor } from '@/components/questionnaire/editor';
import { SurveyHeader } from '@/components/survey-header';
import { Alert } from '@/components/ui/alert';
import { errorMessage, t } from '@/i18n/pt-BR';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.questionnaire.title };

export default async function QuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const { id } = await params;
  if (!Id.safeParse(id).success) {
    notFound();
  }
  const [survey, questionnaire] = await Promise.all([
    apiGet(`/v1/surveys/${id}`, SurveyView),
    apiGet(`/v1/surveys/${id}/questionnaire`, QuestionnaireView),
  ]);
  if (!survey.ok && survey.status === 404) {
    notFound();
  }
  if (!survey.ok || !questionnaire.ok) {
    return <Alert tone="error">{errorMessage(undefined)}</Alert>;
  }
  return (
    <>
      <SurveyHeader survey={survey.data} current="questionnaire" />
      {/* key: a new revision loaded from the server starts a fresh editor. */}
      <QuestionnaireEditor
        key={`${id}-${String(questionnaire.data.revision)}`}
        initial={questionnaire.data}
        publishedVersion={survey.data.publishedVersion}
        canPublish={can(me.role, 'surveys.publish')}
      />
    </>
  );
}
