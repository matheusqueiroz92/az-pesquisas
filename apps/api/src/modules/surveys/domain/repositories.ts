import type { Client } from './client.js';
import type { Survey } from './survey.js';

/**
 * Repository ports. Implementations run inside the current tenant transaction
 * (RLS applies), so none of these methods takes an organizationId.
 */
export interface ClientRepository {
  findById(id: string, options?: { forUpdate?: boolean }): Promise<Client | undefined>;
  list(): Promise<Client[]>;
  add(client: Client): Promise<void>;
  save(client: Client): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SurveyRepository {
  findById(id: string, options?: { forUpdate?: boolean }): Promise<Survey | undefined>;
  list(): Promise<Survey[]>;
  add(survey: Survey): Promise<void>;
  save(survey: Survey): Promise<void>;
  remove(id: string): Promise<void>;
  /** Number of surveys (any status) per client id. */
  countByClient(): Promise<ReadonlyMap<string, number>>;
}
