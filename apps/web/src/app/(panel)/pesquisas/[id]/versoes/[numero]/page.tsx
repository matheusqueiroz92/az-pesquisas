import {
  can,
  Id,
  municipalityByCode,
  QuestionnaireVersionView,
  SurveyView,
} from '@az-pesquisas/contracts';
import type { Question } from '@az-pesquisas/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { Forbidden } from '@/components/forbidden';
import { Alert } from '@/components/ui/alert';
import { errorMessage, t } from '@/i18n/pt-BR';
import { formatBrl, formatDateTime, formatInteger, formatPeriod } from '@/lib/format';
import { municipalityLabel } from '@/lib/surveys';
import { describeCondition } from '@/lib/version-text';
import { apiGet, currentUser } from '@/server/api-client';

import { PrintButton } from './print-button';

export const metadata: Metadata = { title: t.versions.title };

const V = t.versions;

function Items({
  items,
  numbered = false,
}: {
  items: readonly {
    id: string;
    code: string;
    label: string;
    other?: boolean;
    exclusive?: boolean;
    fixed?: boolean;
  }[];
  numbered?: boolean;
}) {
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-sm">
      {items.map((item, i) => (
        <li key={item.id} className="flex gap-3">
          <span className="w-14 shrink-0 font-mono text-xs leading-5 text-muted-foreground">
            {numbered ? `${String(i + 1)}.` : `[${item.code}]`}
          </span>
          <span>
            {item.label}
            {item.other ? ` ${V.other}` : ''}
            {item.exclusive ? ` ${V.exclusive}` : ''}
            {item.fixed ? ` ${V.fixed}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Details({ q }: { q: Question }) {
  switch (q.type) {
    case 'single_choice':
      return (
        <>
          <Items items={q.options} />
          {q.shuffleOptions ? (
            <p className="mt-1 text-xs text-muted-foreground">{V.shuffle}</p>
          ) : null}
        </>
      );
    case 'multiple_choice':
      return (
        <>
          <Items items={q.options} />
          <p className="mt-1 text-xs text-muted-foreground">
            {V.selections(q.minSelections, q.maxSelections)}
            {q.shuffleOptions ? ` · ${V.shuffle}` : ''}
          </p>
        </>
      );
    case 'ranking':
      return (
        <>
          <Items items={q.options} />
          <p className="mt-1 text-xs text-muted-foreground">{V.rank(q.maxRanked)}</p>
        </>
      );
    case 'matrix':
      return (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">{V.rows}</p>
            <Items items={q.rows} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">{V.columns}</p>
            <Items items={q.options} />
          </div>
        </div>
      );
    case 'scale':
      return (
        <p className="mt-2 text-sm">
          {q.min} {q.minLabel ? `(${q.minLabel})` : ''} — {q.max}{' '}
          {q.maxLabel ? `(${q.maxLabel})` : ''}
        </p>
      );
    case 'number':
      return (
        <p className="mt-2 text-sm text-muted-foreground">
          {[
            q.min !== undefined ? `${t.questionnaire.fields.min}: ${String(q.min)}` : null,
            q.max !== undefined ? `${t.questionnaire.fields.max}: ${String(q.max)}` : null,
            q.unit ?? null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      );
    default:
      return null;
  }
}

/** The questionnaire of one version, ready to print or save as PDF (spec 015 rule 16). */
export default async function VersionPage({
  params,
}: {
  params: Promise<{ id: string; numero: string }>;
}) {
  const me = await currentUser();
  if (!can(me.role, 'surveys.manage')) {
    return <Forbidden />;
  }
  const { id, numero } = await params;
  if (!Id.safeParse(id).success || !/^\d{1,6}$/.test(numero)) {
    notFound();
  }
  const [survey, version] = await Promise.all([
    apiGet(`/v1/surveys/${id}`, SurveyView),
    apiGet(`/v1/surveys/${id}/versions/${numero}`, QuestionnaireVersionView),
  ]);
  if ((!survey.ok && survey.status === 404) || (!version.ok && version.status === 404)) {
    notFound();
  }
  if (!survey.ok || !version.ok) {
    return <Alert tone="error">{errorMessage(undefined)}</Alert>;
  }
  const s = survey.data;
  const v = version.data;
  const snapshot = v.snapshot;
  const sheet: [string, string][] = [
    [V.sheetFields.client, s.clientName ?? t.surveys.ownSurvey],
    [V.sheetFields.type, t.surveyTypes[s.type]],
    [V.sheetFields.period, formatPeriod(s.fieldStart, s.fieldEnd, t.surveys.noPeriod)],
    [
      V.sheetFields.municipalities,
      s.municipalityCodes.length === 0
        ? t.common.none
        : s.municipalityCodes
            .map((code) => (municipalityByCode(code) ? municipalityLabel(code) : String(code)))
            .join(', '),
    ],
    [
      V.sheetFields.target,
      s.targetInterviews === null ? t.common.none : formatInteger(s.targetInterviews),
    ],
    [V.sheetFields.version, `${String(v.number)} · ${formatDateTime(v.publishedAt)}`],
  ];
  if (s.tse) {
    sheet.push(
      [V.sheetFields.tseNumber, s.tse.registrationNumber ?? t.common.none],
      [
        V.sheetFields.statistician,
        [
          s.tse.statisticianName,
          s.tse.statisticianConre ? `Conre ${s.tse.statisticianConre}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || t.common.none,
      ],
      [V.sheetFields.contractor, s.tse.contractorName ?? t.common.none],
      [
        V.sheetFields.value,
        s.tse.contractValueCents === null ? t.common.none : formatBrl(s.tse.contractValueCents),
      ],
    );
  }

  return (
    <article className="mx-auto max-w-3xl print:max-w-none" data-testid="version-document">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/pesquisas/${id}/versoes`} label={V.back} />
        <PrintButton />
      </div>

      <header className="border-b-2 border-foreground pb-4">
        <p className="text-sm font-semibold text-muted-foreground">AZ Pesquisas</p>
        <h1 className="text-2xl font-extrabold tracking-tight">{snapshot.title}</h1>
        <p className="font-mono text-xs text-muted-foreground">{V.version(v.number)}</p>
      </header>

      <section className="mt-5 break-inside-avoid">
        <h2 className="text-sm font-bold uppercase">{V.sheet}</h2>
        <dl className="mt-2 grid grid-cols-[12rem_1fr] gap-x-4 gap-y-1 text-sm">
          {sheet.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {snapshot.introText ? (
        <section className="mt-5 break-inside-avoid">
          <h2 className="text-sm font-bold uppercase">{V.intro_text}</h2>
          <p className="mt-1 text-sm whitespace-pre-line">{snapshot.introText}</p>
        </section>
      ) : null}

      <ol className="mt-6 flex flex-col gap-5">
        {snapshot.questions.map((q, index) => (
          <li key={q.id} className="break-inside-avoid border-t border-border pt-4">
            <p className="text-sm">
              <span className="font-bold">{String(index + 1)}.</span>{' '}
              <span className="font-mono text-xs text-muted-foreground">[{q.code}]</span>{' '}
              <span className="font-semibold">{q.text}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t.questionTypes[q.type]} · {q.required ? V.required : V.optional}
            </p>
            {q.helpText ? <p className="mt-1 text-xs italic">{q.helpText}</p> : null}
            {q.visibleIf ? (
              <p className="mt-1 text-xs">
                <span className="font-semibold">{V.showIf}:</span>{' '}
                {describeCondition(q.visibleIf, snapshot.questions)}
              </p>
            ) : null}
            <Details q={q} />
          </li>
        ))}
      </ol>

      <footer className="mt-8 border-t border-border pt-3 text-xs text-muted-foreground">
        {V.generated(formatDateTime(new Date().toISOString()))}
      </footer>
    </article>
  );
}
