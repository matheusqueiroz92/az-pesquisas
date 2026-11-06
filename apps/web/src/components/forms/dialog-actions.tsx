import { Button } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';

/** Footer of a form inside a Dialog: Cancel + submit. */
export function DialogActions({
  pending,
  onCancel,
  submitLabel = t.common.save,
  danger = false,
}: {
  pending: boolean;
  onCancel: () => void;
  submitLabel?: string;
  danger?: boolean;
}) {
  return (
    <div className="-mx-6 mt-2 -mb-5 flex justify-end gap-2 border-t border-border bg-surface-sunken/50 px-6 py-4">
      <Button variant="secondary" onClick={onCancel}>
        {t.common.cancel}
      </Button>
      <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={pending}>
        {submitLabel}
      </Button>
    </div>
  );
}
