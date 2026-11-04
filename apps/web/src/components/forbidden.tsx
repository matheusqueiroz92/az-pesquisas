import { Card } from '@/components/ui/card';
import { t } from '@/i18n/pt-BR';

/** Rule 12: the page says so; the API refuses the data anyway. */
export function Forbidden() {
  return (
    <Card className="max-w-lg">
      <h1 className="text-lg font-semibold">{t.forbidden.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{t.forbidden.body}</p>
    </Card>
  );
}
