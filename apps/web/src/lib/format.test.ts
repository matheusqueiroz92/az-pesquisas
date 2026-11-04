import { describe, expect, it } from 'vitest';

import { formatDateTime } from './format';

describe('formatDateTime', () => {
  it('shows date and time in Brasília time', () => {
    expect(formatDateTime('2026-11-04T15:30:00.000Z')).toBe('04/11/2026, 12:30');
  });

  it('returns the fallback for null', () => {
    expect(formatDateTime(null, 'Nunca')).toBe('Nunca');
  });
});
