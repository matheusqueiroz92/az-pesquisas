const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export const formatDateTime = (iso: string | null, fallback = ''): string =>
  iso === null ? fallback : DATE_TIME.format(new Date(iso));

/** YYYY-MM-DD (a calendar date, no time zone) as dd/mm/aaaa. */
export const formatDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split('-');
  return `${day ?? ''}/${month ?? ''}/${year ?? ''}`;
};

export const formatPeriod = (
  start: string | null,
  end: string | null,
  fallback: string,
): string => {
  if (start && end) {
    return `${formatDate(start)} a ${formatDate(end)}`;
  }
  if (start) {
    return `a partir de ${formatDate(start)}`;
  }
  return end ? `até ${formatDate(end)}` : fallback;
};

/** CPF (11 digits) or CNPJ (14 digits) with the usual mask. */
export const formatTaxId = (digits: string): string => {
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return digits;
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const INTEGER = new Intl.NumberFormat('pt-BR');

export const formatBrl = (cents: number): string => BRL.format(cents / 100);

export const formatInteger = (value: number): string => INTEGER.format(value);

/**
 * Reais as typed in Brazil ("12.500,00", "R$ 12500") to cents. Blank → null;
 * anything else that is not money → undefined.
 */
export const parseBrl = (input: string): number | null | undefined => {
  const text = input.replace(/^\s*R\$\s*/, '').trim();
  if (text === '') {
    return null;
  }
  const match = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/.exec(text);
  if (!match) {
    return undefined;
  }
  const reais = Number((match[1] ?? '0').replace(/\./g, ''));
  const cents = Number((match[2] ?? '0').padEnd(2, '0'));
  return reais * 100 + cents;
};
