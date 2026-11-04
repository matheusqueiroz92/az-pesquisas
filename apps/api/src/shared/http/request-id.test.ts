import { describe, expect, it } from 'vitest';

import { resolveRequestId } from './request-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('resolveRequestId', () => {
  it('reuses a safe incoming id', () => {
    expect(resolveRequestId('req-12345678')).toBe('req-12345678');
    expect(resolveRequestId('0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b')).toBe(
      '0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b',
    );
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['too short', 'abc1234'],
    ['too long', 'a'.repeat(65)],
    ['with spaces', 'req 12345678'],
    ['with injection characters', 'req-1234\r\nset-cookie: x'],
    ['repeated header', ['req-12345678', 'req-87654321']],
  ])('generates a new UUID when the incoming id is %s', (_case, incoming) => {
    expect(resolveRequestId(incoming)).toMatch(UUID);
  });

  it('generates a different id each time', () => {
    expect(resolveRequestId(undefined)).not.toBe(resolveRequestId(undefined));
  });
});
