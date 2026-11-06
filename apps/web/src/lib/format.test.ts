import { describe, expect, it } from 'vitest';

import {
  formatBrl,
  formatDate,
  formatDateTime,
  formatInteger,
  formatPeriod,
  formatTaxId,
  parseBrl,
} from './format';

describe('formatDateTime', () => {
  it('shows date and time in Brasília time', () => {
    expect(formatDateTime('2026-11-04T15:30:00.000Z')).toBe('04/11/2026, 12:30');
  });

  it('returns the fallback for null', () => {
    expect(formatDateTime(null, 'Nunca')).toBe('Nunca');
  });
});

describe('formatDate and formatPeriod', () => {
  it('shows an ISO date as dd/mm/aaaa without time zone shifts', () => {
    expect(formatDate('2026-11-10')).toBe('10/11/2026');
  });

  it.each([
    ['2026-11-10', '2026-11-20', '10/11/2026 a 20/11/2026'],
    ['2026-11-10', null, 'a partir de 10/11/2026'],
    [null, '2026-11-20', 'até 20/11/2026'],
    [null, null, '—'],
  ])('period %s – %s', (start, end, expected) => {
    expect(formatPeriod(start, end, '—')).toBe(expected);
  });
});

describe('formatTaxId', () => {
  it('masks CPF and CNPJ', () => {
    expect(formatTaxId('52998224725')).toBe('529.982.247-25');
    expect(formatTaxId('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatTaxId('123')).toBe('123');
  });
});

describe('money', () => {
  it('formats cents as reais', () => {
    expect(formatBrl(1_250_000).replace(/\s/g, ' ')).toBe('R$ 12.500,00');
  });

  it.each([
    ['12.500,00', 1_250_000],
    ['R$ 12.500,5', 1_250_050],
    ['12500', 1_250_000],
    ['0,99', 99],
    ['', null],
    ['  ', null],
  ])('parses %j', (input, expected) => {
    expect(parseBrl(input)).toBe(expected);
  });

  it.each(['doze reais', '1,2,3', '12,345'])('refuses %j', (input) => {
    expect(parseBrl(input)).toBeUndefined();
  });

  it('formats integers with thousand separators', () => {
    expect(formatInteger(1_000_000)).toBe('1.000.000');
  });
});

describe('formatDate edge', () => {
  it('does not crash on a malformed date', () => {
    expect(formatDate('2026')).toBe('//2026');
  });
});
