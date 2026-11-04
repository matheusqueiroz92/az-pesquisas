import type { Tx } from '../database/database.js';
import { newId } from '../ids.js';
import { currentOrganizationId } from '../tenancy/tenant-context.js';
import { outboxEvents } from './schema.js';

export interface OutboxEvent {
  /** PascalCase past-tense fact, e.g. "InterviewReceived". */
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Stores an event in the same transaction as the business change. It is
 * published to the queue after commit (publisher: later spec), so a crash in
 * between never loses it. Returns the event id.
 */
export const recordEvent = async (tx: Tx, event: OutboxEvent): Promise<string> => {
  const id = newId();
  await tx.insert(outboxEvents).values({
    id,
    organizationId: currentOrganizationId(),
    type: event.type,
    payload: event.payload,
  });
  return id;
};
