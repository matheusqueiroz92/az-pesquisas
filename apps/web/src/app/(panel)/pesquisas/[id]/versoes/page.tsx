import { can, Id, QuestionnaireVersionList, SurveyView } from '@az-pesquisas/contracts';
import { FileText, History } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Forbidden } from '@/components/forbidden';
import { SurveyHeader } from '@/components/survey-header';
import { Alert } from '@/components/ui/alert';
import { errorMessage, t } from '@/i18n/pt-BR';
import { formatDateTime } from '@/lib/format';
import { describeChange } from '@/lib/version-text';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.versions.title };

const V = t.versions;

export default async function VersionsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await currentUser();
  if (!can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const { id } = await params;
  if (!Id.safeParse(id).success) {
    notFound();
  }
  const [survey, versions] = await Promise.all([
    apiGet(`/v1/surveys/${id}`, SurveyView),
    apiGet(`/v1/surveys/${id}/versions`, QuestionnaireVersionList),
  ]);
  if (!survey.ok && survey.status === 404) {
    notFound();
  }
  if (!survey.ok || !versions.ok) {
    return <Alert tone="error">{errorMessage(undefined)}</Alert>;
  }
  const items = versions.data.items;

  return (
    <>
      <SurveyHeader survey={survey.data} current="versions" />
      <p className="mb-6 max-w-2xl text-muted-foreground">{V.intro}</p>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong p-12 text-center">
          <History aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">{V.empty}</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {items.map((version) => (
            <li
              key={version.id}
              data-testid="version-row"
              className="rounded-md border border-border bg-surface p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{V.version(version.number)}</h2>
                  <p className="font-mono text-xs tabular text-muted-foreground">
                    {V.publishedAt} {formatDateTime(version.publishedAt)} ·{' '}
                    {V.questions(version.questionCount)}
                  </p>
                </div>
                <Link
                  href={`/pesquisas/${id}/versoes/${String(version.number)}`}
                  className="inline-flex h-10 items-center gap-2 rounded-sm border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-muted [&_svg]:size-4"
                >
                  <FileText aria-hidden />
                  {V.open}
                </Link>
              </div>
              {version.changes.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{V.firstVersion}</p>
              ) : (
                <ul className="mt-3 flex list-disc flex-col gap-0.5 pl-5 text-sm">
                  {version.changes.map((change, index) => (
                    <li
                      key={`${change.kind}-${change.itemId ?? change.questionId ?? ''}-${String(index)}`}
                    >
                      {describeChange(change)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
