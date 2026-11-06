import { currentTx } from '../database/transaction-context.js';
import { newId } from '../ids.js';
import { currentOrganizationId } from '../tenancy/tenant-context.js';
import { auditLogs } from './schema.js';

export interface AuditEntry<Action extends string = string, Entity extends string = string> {
  readonly action: Action;
  readonly actorUserId: string | null;
  readonly entity: Entity;
  readonly entityId: string;
  /** Never values typed by people or field data (AGENTS.md rule 10): names of fields, counts. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Append-only: az_app has no UPDATE/DELETE on audit_logs (migration 0003). Appends to the audit log of the current organization, in the current transaction. */
export const drizzleAuditLog = {
  record: async (entry: AuditEntry): Promise<void> => {
    await currentTx()
      .insert(auditLogs)
      .values({
        id: newId(),
        organizationId: currentOrganizationId(),
        actorUserId: entry.actorUserId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        metadata: entry.metadata ?? {},
      });
  },
};
