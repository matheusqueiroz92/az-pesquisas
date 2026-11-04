const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export const formatDateTime = (iso: string | null, fallback = ''): string =>
  iso === null ? fallback : DATE_TIME.format(new Date(iso));
