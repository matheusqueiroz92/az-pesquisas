import type {
  OrganizationRepository,
  PasswordResetRepository,
  SessionRepository,
  UserRepository,
} from '../domain/repositories.js';
import type {
  AccessTokenIssuer,
  AuditLog,
  AuthLookup,
  Clock,
  IdGenerator,
  Mailer,
  PasswordHasher,
  TokenGenerator,
  TransactionRunner,
} from './ports.js';

/** Everything the identity use cases depend on. Wired by the Nest module (presentation). */
export interface IdentityDeps {
  readonly users: UserRepository;
  readonly sessions: SessionRepository;
  readonly passwordResets: PasswordResetRepository;
  readonly organizations: OrganizationRepository;
  readonly lookup: AuthLookup;
  readonly tx: TransactionRunner;
  readonly audit: AuditLog;
  readonly hasher: PasswordHasher;
  readonly tokens: TokenGenerator;
  readonly accessTokens: AccessTokenIssuer;
  readonly mailer: Mailer;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly settings: {
    /** Base URL of the web panel, for links in e-mails. */
    readonly panelUrl: string;
  };
}
