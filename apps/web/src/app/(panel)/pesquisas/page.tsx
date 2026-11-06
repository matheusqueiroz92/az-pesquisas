import { can, SurveyListResponse } from '@az-pesquisas/contracts';
import { ClipboardList, Plus, Search } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Forbidden } from '@/components/forbidden';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/ui/alert';
import { StatusBadge } from '@/components/ui/badge';
import { errorMessage, t } from '@/i18n/pt-BR';
import { cn } from '@/lib/cn';
import { formatInteger, formatPeriod } from '@/lib/format';
import { filterSurveys, param, STATUS_TONE } from '@/lib/surveys';
import { apiGet, currentUser } from '@/server/api-client';

export const metadata: Metadata = { title: t.surveys.title };

const TH = 'px-5 py-3 text-left text-xs font-bold text-muted-foreground';
const WIDE = 'hidden lg:table-cell';
const TAB =
  'inline-flex h-9 items-center rounded-sm px-3 text-sm font-semibold transition-colors hover:bg-muted';

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await currentUser();
  if (!can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const list = await apiGet('/v1/surveys', SurveyListResponse);
  if (!list.ok) {
    return (
      <Alert tone="error">{errorMessage(list.status === 403 ? 'FORBIDDEN' : undefined)}</Alert>
    );
  }
  const params = await searchParams;
  const query = param(params['q']);
  const archived = param(params['arquivadas']) === '1';
  const surveys = filterSurveys(list.data.items, { query, archived });
  const emptyText = query
    ? t.surveys.emptySearch
    : archived
      ? t.surveys.emptyArchived
      : t.surveys.empty;
  const tabHref = (toArchived: boolean) => {
    const search = new URLSearchParams();
    if (query) {
      search.set('q', query);
    }
    if (toArchived) {
      search.set('arquivadas', '1');
    }
    const text = search.toString();
    return text ? `/pesquisas?${text}` : '/pesquisas';
  };

  return (
    <>
      <PageHeader
        title={t.surveys.title}
        intro={t.surveys.intro}
        action={
          <Link
            href="/pesquisas/nova"
            className="inline-flex h-touch items-center gap-2 rounded-sm bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)] transition-colors hover:bg-primary-hover [&_svg]:size-4"
          >
            <Plus aria-hidden />
            {t.surveys.new}
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t.surveys.status} className="flex gap-1">
          <Link
            href={tabHref(false)}
            aria-current={archived ? undefined : 'page'}
            className={cn(TAB, !archived && 'bg-surface shadow-card ring-1 ring-border')}
          >
            {t.surveys.filterActive}
          </Link>
          <Link
            href={tabHref(true)}
            aria-current={archived ? 'page' : undefined}
            className={cn(TAB, archived && 'bg-surface shadow-card ring-1 ring-border')}
          >
            {t.surveys.filterArchived}
          </Link>
        </nav>
        <form role="search" action="/pesquisas" className="flex w-full gap-2 sm:w-auto">
          {archived ? <input type="hidden" name="arquivadas" value="1" /> : null}
          <label className="sr-only" htmlFor="survey-search">
            {t.surveys.search}
          </label>
          <div className="relative w-full sm:w-72">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="survey-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder={t.surveys.search}
              className="h-10 w-full rounded-sm border border-border-strong bg-surface pr-3 pl-9 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30"
            />
          </div>
          <button
            type="submit"
            className="h-10 rounded-sm border border-border-strong bg-surface px-4 text-sm font-semibold hover:bg-muted"
          >
            {t.surveys.searchSubmit}
          </button>
        </form>
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong p-12 text-center">
          <ClipboardList aria-hidden className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">{emptyText}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t.surveys.title}</caption>
              <thead className="border-b border-border bg-surface-sunken/60">
                <tr>
                  <th scope="col" className={TH}>
                    {t.surveys.survey}
                  </th>
                  <th scope="col" className={cn(TH, 'hidden md:table-cell')}>
                    {t.surveys.status}
                  </th>
                  <th scope="col" className={cn(TH, WIDE)}>
                    {t.surveys.period}
                  </th>
                  <th scope="col" className={cn(TH, WIDE, 'text-right')}>
                    {t.surveys.target}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {surveys.map((survey) => (
                  <tr
                    key={survey.id}
                    data-testid="survey-row"
                    className="relative transition-colors hover:bg-background/60"
                  >
                    <td className="px-5 py-3">
                      {/* The whole row is clickable through this link (after:inset-0). */}
                      <Link
                        href={`/pesquisas/${survey.id}`}
                        className="font-semibold after:absolute after:inset-0 hover:text-link"
                      >
                        {survey.title}
                      </Link>
                      <p className="text-muted-foreground">
                        {survey.clientName ?? t.surveys.ownSurvey} · {t.surveyTypes[survey.type]}
                        {survey.municipalityCount > 0
                          ? ` · ${t.surveys.municipalityCount(survey.municipalityCount)}`
                          : ''}
                      </p>
                      <p className="mt-1.5 md:hidden">
                        <StatusBadge tone={STATUS_TONE[survey.status]}>
                          {t.surveyStatuses[survey.status]}
                        </StatusBadge>
                      </p>
                    </td>
                    <td className="hidden px-5 py-3 md:table-cell">
                      <StatusBadge tone={STATUS_TONE[survey.status]}>
                        {t.surveyStatuses[survey.status]}
                      </StatusBadge>
                    </td>
                    <td
                      className={cn(
                        'px-5 py-3 font-mono text-xs font-medium tabular text-muted-foreground',
                        WIDE,
                      )}
                    >
                      {formatPeriod(survey.fieldStart, survey.fieldEnd, t.surveys.noPeriod)}
                    </td>
                    <td className={cn('px-5 py-3 text-right font-mono tabular', WIDE)}>
                      {survey.targetInterviews === null
                        ? t.common.none
                        : formatInteger(survey.targetInterviews)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <span className="font-mono tabular">{surveys.length}</span>{' '}
            {t.surveys.count(surveys.length)}
          </p>
        </div>
      )}
    </>
  );
}
