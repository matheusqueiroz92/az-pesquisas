import type { ClientRepository, SurveyRepository } from '../domain/repositories.js';
import type { AuditLog, Clock, IdGenerator, TransactionRunner } from './ports.js';

/** Everything the surveys use cases depend on. Wired by the Nest module (presentation). */
export interface SurveysDeps {
  readonly clients: ClientRepository;
  readonly surveys: SurveyRepository;
  readonly tx: TransactionRunner;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}
