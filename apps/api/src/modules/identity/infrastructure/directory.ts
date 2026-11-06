import { and, asc, eq } from 'drizzle-orm';

import { currentTx } from '../../../shared/database/transaction-context.js';
import { organizations, users } from './schema.js';

/**
 * What other contexts may read about people and the organization (AGENTS.md
 * rule 4). Runs in the caller's tenant transaction, so RLS applies.
 */
export const identityDirectory = {
  /** Active users with the interviewer role, by name. */
  activeInterviewers: async (): Promise<{ id: string; name: string; email: string }[]> =>
    currentTx()
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, 'interviewer'), eq(users.status, 'active')))
      .orderBy(asc(users.name)),

  organizationName: async (organizationId: string): Promise<string | undefined> => {
    const [row] = await currentTx()
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    return row?.name;
  },
};
