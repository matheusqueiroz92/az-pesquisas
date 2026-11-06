'use client';

import type { ClientView } from '@az-pesquisas/contracts';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { t } from '@/i18n/pt-BR';
import { formatTaxId } from '@/lib/format';
import { send } from '@/lib/http';
import { formText } from '@/lib/survey-form';

import { DialogActions } from './dialog-actions';
import { useSubmit } from './use-submit';

const FIELDS = ['name', 'document', 'contactName', 'contactEmail', 'contactPhone'] as const;

/** Reads the form; blank optional fields go as null (the API turns '' into null too). */
const readForm = (form: HTMLFormElement): Record<(typeof FIELDS)[number], string> => {
  const data = new FormData(form);
  return Object.fromEntries(FIELDS.map((field) => [field, formText(data, field)])) as Record<
    (typeof FIELDS)[number],
    string
  >;
};

function ClientFields({
  client,
  invalid,
}: {
  client?: ClientView;
  invalid: (field: string) => boolean;
}) {
  return (
    <>
      <TextField
        label={t.clients.name}
        name="name"
        defaultValue={client?.name}
        required
        minLength={2}
        maxLength={120}
        invalid={invalid('name')}
      />
      <TextField
        label={t.clients.document}
        name="document"
        inputMode="numeric"
        defaultValue={client?.document ? formatTaxId(client.document) : ''}
        hint={t.clients.documentHint}
        invalid={invalid('document')}
      />
      <TextField
        label={t.clients.contactName}
        name="contactName"
        defaultValue={client?.contactName ?? ''}
        maxLength={120}
        invalid={invalid('contactName')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label={t.clients.contactEmail}
          name="contactEmail"
          type="email"
          defaultValue={client?.contactEmail ?? ''}
          invalid={invalid('contactEmail')}
        />
        <TextField
          label={t.clients.contactPhone}
          name="contactPhone"
          type="tel"
          defaultValue={client?.contactPhone ?? ''}
          invalid={invalid('contactPhone')}
        />
      </div>
    </>
  );
}

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  const { submit, error, pending } = useSubmit(close);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = readForm(event.currentTarget);
    void submit(() => send('POST', '/api/v1/clients', body));
  };

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus aria-hidden />
        {t.clients.new}
      </Button>
      <Dialog open={open} title={t.clients.new} onClose={close}>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error.message}</Alert> : null}
          <ClientFields invalid={(field) => error?.fields.includes(field) === true} />
          <DialogActions pending={pending} onCancel={close} />
        </form>
      </Dialog>
    </>
  );
}

export function EditClientButton({ client }: { client: ClientView }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  const { submit, error, pending } = useSubmit(close);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(() => send('PATCH', `/api/v1/clients/${client.id}`, readForm(event.currentTarget)));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={`${t.clients.edit} ${client.name}`}
      >
        <Pencil aria-hidden />
        <span className="hidden md:inline">{t.clients.edit}</span>
      </Button>
      <Dialog open={open} title={`${t.clients.edit}: ${client.name}`} onClose={close}>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error.message}</Alert> : null}
          <ClientFields
            client={client}
            invalid={(field) => error?.fields.includes(field) === true}
          />
          <DialogActions pending={pending} onCancel={close} />
        </form>
      </Dialog>
    </>
  );
}

export function DeleteClientButton({ client }: { client: ClientView }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  const { submit, error, pending } = useSubmit(close);

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(() => send('DELETE', `/api/v1/clients/${client.id}`));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={`${t.common.delete} ${client.name}`}
      >
        <Trash2 aria-hidden />
      </Button>
      <Dialog
        open={open}
        title={t.clients.deleteTitle(client.name)}
        description={t.clients.deleteBody}
        onClose={close}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error.message}</Alert> : null}
          <DialogActions pending={pending} onCancel={close} submitLabel={t.common.delete} danger />
        </form>
      </Dialog>
    </>
  );
}
