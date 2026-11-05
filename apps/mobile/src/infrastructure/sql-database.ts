/** The part of expo-sqlite's SQLiteDatabase we use (a port, so it can be tested off-device). */
export interface SqlDatabase {
  readonly execAsync: (sql: string) => Promise<void>;
  readonly runAsync: (sql: string, params: readonly (string | number | null)[]) => Promise<unknown>;
  readonly getFirstAsync: <T>(sql: string) => Promise<T | null>;
  readonly withExclusiveTransactionAsync: (
    task: (txn: SqlDatabase) => Promise<void>,
  ) => Promise<void>;
  readonly closeAsync: () => Promise<void>;
}
