import type { SurveyView } from '@az-pesquisas/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { BackLink } from '@/components/back-link';
import { StatusBadge } from '@/components/ui/badge';
import { t } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { STATUS_TONE } from '@/lib/surveys';

const TAB =
  'relative -mb-px inline-flex h-11 items-center border-b-2 px-1 text-sm font-semibold transition-colors';

/** Title, status and tabs shared by the pages of one survey. */
export function SurveyHeader({
  survey,
  current,
  actions,
}: {
  survey: SurveyView;
  current: 'survey' | 'questionnaire' | 'versions' | 'team';
  actions?: ReactNode;
}) {
  const tabs = [
    { key: 'survey', href: `/pesquisas/${survey.id}`, label: t.questionnaire.tabSurvey },
    {
      key: 'questionnaire',
      href: `/pesquisas/${survey.id}/questionario`,
      label: t.questionnaire.tabQuestionnaire,
    },
    { key: 'versions', href: `/pesquisas/${survey.id}/versoes`, label: t.versions.tab },
    { key: 'team', href: `/pesquisas/${survey.id}/equipe`, label: t.team.tab },
  ] as const;
  return (
    <>
      <BackLink href="/pesquisas" label={t.surveys.back} />
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="max-w-2xl">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge tone={STATUS_TONE[survey.status]}>
              {t.surveyStatuses[survey.status]}
            </StatusBadge>
            <span>{t.surveyTypes[survey.type]}</span>
            <span aria-hidden>·</span>
            <span>{survey.clientName ?? t.surveys.ownSurvey}</span>
            {survey.publishedVersion > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-mono">v{survey.publishedVersion}</span>
              </>
            ) : null}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{survey.title}</h1>
          <p className="mt-2 font-mono text-xs tabular text-muted-foreground">
            {t.surveys.updatedAt} {formatDateTime(survey.updatedAt)}
          </p>
        </div>
        {actions}
      </header>
      <nav aria-label={survey.title} className="mb-8 flex gap-6 border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current === tab.key ? 'page' : undefined}
            className={cn(
              TAB,
              current === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
