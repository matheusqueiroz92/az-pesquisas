import { AsyncLocalStorage } from 'node:async_hooks';

import type { Database, Tx } from './database.js';

/**
 * Lets repositories find the current transaction without the application layer
 * ever touching Drizzle (AGENTS.md rule 3): use cases call TransactionRunner.run(),
 * repositories call currentTx().
 */
const storage = new AsyncLocalStorage<Tx>();

export const currentTx = (): Tx => {
  const tx = storage.getStore();
  if (!tx) {
    throw new Error('Repository used outside a transaction: wrap the use case in tx.run()');
  }
  return tx;
};

export const createTransactionRunner = (database: Database) => ({
  run: <T>(work: () => Promise<T>): Promise<T> => {
    // Nested run() joins the open transaction instead of opening a second one.
    if (storage.getStore()) {
      return work();
    }
    return database.withTenantTransaction((tx) => storage.run(tx, work));
  },
});
