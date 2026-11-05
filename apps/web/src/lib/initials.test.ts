import { describe, expect, it } from 'vitest';

import { initials } from './initials';

describe('initials', () => {
  it.each([
    ['Ana Maria Souza', 'AS'],
    ['ana', 'A'],
    ['  Bruno   Lima ', 'BL'],
    ['', ''],
  ])('%s -> %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
