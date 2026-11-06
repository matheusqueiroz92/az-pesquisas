import type { SurveyStatus, SurveySummary } from '@az-pesquisas/contracts';

/** Lower-case without accents, for searches typed without them ("avaliacao"). */
export const foldText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/** The panel list: archived only on request; title search ignores case and accents. */
export const filterSurveys = (
  items: readonly SurveySummary[],
  options: { query: string; archived: boolean },
): SurveySummary[] => {
  const query = foldText(options.query);
  return items.filter(
    (survey) =>
      (survey.status === 'archived') === options.archived &&
      (query === '' || foldText(survey.title).includes(query)),
  );
};

export const STATUS_TONE: Record<SurveyStatus, 'neutral' | 'success' | 'info' | 'warning'> = {
  draft: 'warning',
  in_field: 'success',
  closed: 'info',
  archived: 'neutral',
};

/** First value of a search param. */
export const param = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value) ?? '';
