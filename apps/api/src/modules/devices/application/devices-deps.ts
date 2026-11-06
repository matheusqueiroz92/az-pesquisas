import type {
  DeviceRepository,
  PairingRepository,
  TeamRepository,
} from '../domain/repositories.js';
import type {
  AuditLog,
  Clock,
  CrossTenantLookup,
  DevicePolicy,
  IdGenerator,
  PeopleDirectory,
  Secrets,
  SurveyDirectory,
  TransactionRunner,
} from './ports.js';

export interface DevicesDeps {
  readonly devices: DeviceRepository;
  readonly pairings: PairingRepository;
  readonly teams: TeamRepository;
  readonly lookup: CrossTenantLookup;
  readonly surveys: SurveyDirectory;
  readonly people: PeopleDirectory;
  readonly secrets: Secrets;
  readonly tx: TransactionRunner;
  readonly audit: AuditLog;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly policy: DevicePolicy;
}
