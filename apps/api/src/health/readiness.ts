/**
 * A dependency the API needs before receiving traffic (database, Redis, storage).
 * Each infrastructure module registers its own check (spec 004 adds Postgres).
 */
export interface ReadinessCheck {
  readonly name: string;
  readonly check: () => Promise<void>;
}

export const READINESS_CHECKS = Symbol('READINESS_CHECKS');

export interface ReadinessReport {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, 'up' | 'down'>>;
}

const withTimeout = (promise: Promise<void>, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('readiness check timed out'));
    }, timeoutMs);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });

/** Runs all checks in parallel. Failure messages are dropped: they may contain hosts or credentials. */
export const runReadinessChecks = async (
  checks: readonly ReadinessCheck[],
  options: { timeoutMs?: number } = {},
): Promise<ReadinessReport> => {
  const timeoutMs = options.timeoutMs ?? 3000;
  const outcomes = await Promise.allSettled(
    checks.map((c) => withTimeout(Promise.resolve().then(c.check), timeoutMs)),
  );

  const results: Record<string, 'up' | 'down'> = {};
  checks.forEach((c, index) => {
    results[c.name] = outcomes[index]?.status === 'fulfilled' ? 'up' : 'down';
  });

  return { ready: Object.values(results).every((s) => s === 'up'), checks: results };
};
