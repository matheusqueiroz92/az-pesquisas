import { describe, expect, it } from 'vitest';

import { runReadinessChecks } from './readiness.js';
import type { ReadinessCheck } from './readiness.js';

const passing = (name: string): ReadinessCheck => ({ name, check: () => Promise.resolve() });
const failing = (name: string, message: string): ReadinessCheck => ({
  name,
  check: () => Promise.reject(new Error(message)),
});

describe('runReadinessChecks', () => {
  it('is ready when there are no checks', async () => {
    await expect(runReadinessChecks([])).resolves.toEqual({ ready: true, checks: {} });
  });

  it('is ready when every check passes', async () => {
    await expect(runReadinessChecks([passing('database'), passing('redis')])).resolves.toEqual({
      ready: true,
      checks: { database: 'up', redis: 'up' },
    });
  });

  it('is not ready when any check fails, and says which one', async () => {
    await expect(
      runReadinessChecks([passing('database'), failing('redis', 'ECONNREFUSED 10.0.0.5:6379')]),
    ).resolves.toEqual({ ready: false, checks: { database: 'up', redis: 'down' } });
  });

  it('does not expose the failure message (it may contain hosts or credentials)', async () => {
    const report = await runReadinessChecks([failing('database', 'password=hunter2')]);

    expect(JSON.stringify(report)).not.toContain('hunter2');
  });

  it('treats a check that never answers as down after the timeout', async () => {
    const hanging: ReadinessCheck = { name: 'storage', check: () => new Promise(() => undefined) };

    await expect(runReadinessChecks([hanging], { timeoutMs: 20 })).resolves.toEqual({
      ready: false,
      checks: { storage: 'down' },
    });
  });
});
