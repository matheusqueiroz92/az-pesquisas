'use client';

import type { SurveyView } from '@az-pesquisas/contracts';
import { Archive, ArchiveRestore, Copy, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';
import type { SendResult } from '@/lib/http';

import { DialogActions } from './dialog-actions';

/** Duplicate, archive/unarchive and delete, on the page of a survey (spec 013). */
export function SurveyActions({ survey }: { survey: SurveyView }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async <T,>(call: () => Promise<SendResult<T>>, then: (data: T) => void) => {
    setPending(true);
    setError(undefined);
    const result = await call();
    setPending(false);
    if (result.ok) {
      then(result.data);
      return;
    }
    if (result.status === 401) {
      window.location.assign('/login');
      return;
    }
    setError(errorMessage(result.code));
  };

  const base = `/api/v1/surveys/${survey.id}`;
  const archived = survey.status === 'archived';

  const onDelete = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(
      () => send('DELETE', base),
      () => {
        setConfirmDelete(false);
        router.push('/pesquisas');
        router.refresh();
      },
    );
  };

  return (
    <div className="flex flex-col items-end gap-3">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            void run(
              () => send<SurveyView>('POST', `${base}/duplicate`),
              (copy) => {
                router.push(`/pesquisas/${copy.id}`);
              },
            );
          }}
        >
          <Copy aria-hidden />
          {t.surveys.duplicate}
        </Button>
        {archived || survey.status === 'draft' ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              void run(
                () => send('POST', `${base}/${archived ? 'unarchive' : 'archive'}`),
                () => {
                  router.refresh();
                },
              );
            }}
          >
            {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {archived ? t.surveys.unarchive : t.surveys.archive}
          </Button>
        ) : null}
        {survey.status === 'draft' ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setConfirmDelete(true);
            }}
          >
            <Trash2 aria-hidden />
            {t.surveys.delete}
          </Button>
        ) : null}
      </div>
      {error && !confirmDelete ? <Alert tone="error">{error}</Alert> : null}
      <Dialog
        open={confirmDelete}
        title={t.surveys.deleteTitle}
        description={t.surveys.deleteBody}
        onClose={() => {
          setConfirmDelete(false);
        }}
      >
        <form onSubmit={onDelete} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <DialogActions
            pending={pending}
            onCancel={() => {
              setConfirmDelete(false);
            }}
            submitLabel={t.surveys.delete}
            danger
          />
        </form>
      </Dialog>
    </div>
  );
}
