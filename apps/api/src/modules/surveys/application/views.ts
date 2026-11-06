import type { Client, ClientFields } from '../domain/client.js';
import type { Survey, SurveyFields } from '../domain/survey.js';
import type { SurveyStatus } from '@az-pesquisas/contracts';

/** A client as the panel sees it (ClientView). */
export interface ClientDetails extends ClientFields {
  readonly id: string;
  readonly surveyCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** A survey as the panel sees it (SurveyView). */
export interface SurveyDetails extends SurveyFields {
  readonly id: string;
  readonly status: SurveyStatus;
  readonly clientName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const toClientDetails = (client: Client, surveyCount: number): ClientDetails => {
  const { organizationId: _org, ...rest } = client.toSnapshot();
  return { ...rest, surveyCount };
};

export const toSurveyDetails = (survey: Survey, clientName: string | null): SurveyDetails => {
  const { organizationId: _org, ...rest } = survey.toSnapshot();
  return { ...rest, clientName };
};
