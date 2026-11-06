import type { ClientView, SurveySummary, SurveyView } from '@az-pesquisas/contracts';

import type { ClientDetails, SurveyDetails } from '../application/views.js';
import type { SurveySummaryDetails } from '../application/surveys.js';

export const toClientView = (client: ClientDetails): ClientView => ({
  ...client,
  createdAt: client.createdAt.toISOString(),
  updatedAt: client.updatedAt.toISOString(),
});

export const toSurveyView = (survey: SurveyDetails): SurveyView => ({
  ...survey,
  municipalityCodes: [...survey.municipalityCodes],
  createdAt: survey.createdAt.toISOString(),
  updatedAt: survey.updatedAt.toISOString(),
});

export const toSurveySummary = (survey: SurveySummaryDetails): SurveySummary => ({
  ...survey,
  updatedAt: survey.updatedAt.toISOString(),
});
