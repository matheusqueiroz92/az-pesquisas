export type { Actor } from '../../../shared/auth/actor.js';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

/** Runs work in one database transaction of the current organization (RLS on). */
export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export type AuditAction =
  | 'client.created'
  | 'client.updated'
  | 'client.deleted'
  | 'survey.created'
  | 'survey.updated'
  | 'survey.archived'
  | 'survey.unarchived'
  | 'survey.duplicated'
  | 'survey.deleted';

export interface AuditLog {
  /**
   * Appends to the audit log of the current organization, in the current
   * transaction. Metadata names fields, never their values (AGENTS.md rule 10).
   */
  record(entry: {
    action: AuditAction;
    actorUserId: string | null;
    entity: 'client' | 'survey';
    entityId: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}
