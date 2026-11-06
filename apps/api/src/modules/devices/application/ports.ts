import type { SurveyStatus } from '@az-pesquisas/contracts';

export type { Actor } from '../../../shared/auth/actor.js';

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}

export interface TransactionRunner {
  run<T>(work: () => Promise<T>): Promise<T>;
}

export type AuditAction =
  | 'device.pairing_created'
  | 'device.paired'
  | 'device.renamed'
  | 'device.revoked'
  | 'survey.team_updated';

export interface AuditLog {
  /** Metadata names things and counts them; never tokens or codes (rule 10). */
  record(entry: {
    action: AuditAction;
    actorUserId: string | null;
    entity: 'device' | 'device_pairing' | 'survey';
    entityId: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void>;
}

/** Random secrets and their hashes. */
export interface Secrets {
  /** 256-bit device token. */
  newToken(): string;
  /** 6 random digits. */
  newCode(): string;
  hash(value: string): string;
}

/**
 * Lookups across organizations, for the app before it has a tenant (SECURITY
 * DEFINER functions): they return only ids; everything else is read with RLS on.
 */
export interface CrossTenantLookup {
  pendingPairingByCodeHash(
    codeHash: string,
  ): Promise<{ pairingId: string; organizationId: string } | undefined>;
  deviceByTokenHash(
    tokenHash: string,
  ): Promise<{ deviceId: string; organizationId: string } | undefined>;
}

/** Read access to the surveys context (its public directory). */
export interface SurveyDirectory {
  find(ids: readonly string[]): Promise<{ id: string; title: string; status: SurveyStatus }[]>;
}

/** Read access to the identity context (its public directory). */
export interface PeopleDirectory {
  activeInterviewers(): Promise<{ id: string; name: string; email: string }[]>;
  organizationName(organizationId: string): Promise<string | undefined>;
}

export interface DevicePolicy {
  /** Older apps are told to update (spec 006 heartbeat). */
  readonly minimumAppVersion: string;
  readonly deleteSyncedAfterDays: number;
}
