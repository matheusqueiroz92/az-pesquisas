import { expect, it } from 'vitest';

import { createTestDatabase } from './support/test-database.js';

// Regression: test files run in parallel and each bootstraps its own database.
// Concurrent ALTER ROLE used to fail with "tuple concurrently updated" (seen on
// a faster machine). This creates several databases at once to keep it fixed.
it('bootstraps several test databases concurrently', async () => {
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => createTestDatabase()));

  const failures = results.flatMap((r) => (r.status === 'rejected' ? [String(r.reason)] : []));
  await Promise.all(results.flatMap((r) => (r.status === 'fulfilled' ? [r.value.drop()] : [])));

  expect(failures).toEqual([]);
}, 120_000);
