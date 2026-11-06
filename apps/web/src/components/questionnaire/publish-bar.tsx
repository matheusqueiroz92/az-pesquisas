'use client';

import { affectsComparability } from '@az-pesquisas/contracts';
import type { PublicationPreview, QuestionnaireVersionSummary } from '@az-pesquisas/contracts';
import { Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { DialogActions } from '@/components/forms/dialog-actions';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';
import { describeChange } from '@/lib/version-text';

const P = t.publication;

/** "Publish version N" with the preview of what changes (spec 015). */
export function PublishBar({
  surveyId,
  publishedVersion,
  saved,
}: {
  surveyId: string;
  publishedVersion: number;
  /** The draft has no unsaved change: what is published is what is on screen. */
  saved: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<PublicationPreview>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<number>();

  const close = () => {
    setOpen(false);
    setPreview(undefined);
    setError(undefined);
  };

  const start = async () => {
    setDone(undefined);
    setError(undefined);
    setPreview(undefined);
    setOpen(true);
    const result = await send<PublicationPreview>(
      'GET',
      `/api/v1/surveys/${surveyId}/questionnaire/publication`,
    );
    if (result.ok) {
      setPreview(result.data);
    } else {
      setError(errorMessage(result.code));
    }
  };

  const publish = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!preview) {
      return;
    }
    setPending(true);
    const result = await send<QuestionnaireVersionSummary>(
      'POST',
      `/api/v1/surveys/${surveyId}/questionnaire/publish`,
      { revision: preview.revision },
    );
    setPending(false);
    if (!result.ok) {
      setError(errorMessage(result.code));
      return;
    }
    close();
    setDone(result.data.number);
    router.refresh();
  };

  const next = preview?.nextVersionNumber ?? publishedVersion + 1;
  const comparability = preview?.changes.some(affectsComparability) === true;
  const removed = preview?.changes.some((c) => c.kind.endsWith('_removed')) === true;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span data-testid="published-version" className="text-sm text-muted-foreground">
        {P.published(publishedVersion)}
      </span>
      <Button
        onClick={() => {
          void start();
        }}
        disabled={!saved}
        title={saved ? undefined : P.saveFirst}
      >
        <Send aria-hidden />
        {P.publish(publishedVersion + 1)}
      </Button>
      {done ? (
        <p role="status" className="w-full text-sm font-semibold text-success-foreground">
          {P.done(done)}
        </p>
      ) : null}
      <Dialog open={open} title={P.title(next)} onClose={close}>
        <form
          onSubmit={(event) => {
            void publish(event);
          }}
          className="flex flex-col gap-4"
          data-testid="publish-dialog"
        >
          {error ? <Alert tone="error">{error}</Alert> : null}
          {!preview && !error ? <p className="text-sm text-muted-foreground">{P.loading}</p> : null}
          {preview ? (
            <>
              {preview.blocker ? (
                <Alert tone="error">{P.blockers[preview.blocker]}</Alert>
              ) : (
                <p className="text-sm">{preview.nextVersionNumber === 1 ? P.first : P.next}</p>
              )}
              {preview.tseMissing.length > 0 ? (
                <p className="text-sm">
                  {P.tseMissing} {preview.tseMissing.map((f) => P.tseFields[f]).join(', ')}.
                </p>
              ) : null}
              {preview.changes.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">{P.changes}</p>
                  <ul className="flex max-h-60 list-disc flex-col gap-1 overflow-y-auto pl-5 text-sm">
                    {preview.changes.map((change, index) => (
                      <li
                        key={`${change.kind}-${change.questionId ?? ''}-${change.itemId ?? ''}-${String(index)}`}
                      >
                        {describeChange(change)}
                      </li>
                    ))}
                  </ul>
                  {comparability ? <Alert tone="warning">{P.comparability}</Alert> : null}
                  {removed ? (
                    <p className="text-xs text-muted-foreground">{P.removedNote}</p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          {preview && !preview.blocker ? (
            <DialogActions pending={pending} onCancel={close} submitLabel={P.confirm} />
          ) : (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={close}>
                {t.common.cancel}
              </Button>
            </div>
          )}
        </form>
      </Dialog>
    </div>
  );
}
