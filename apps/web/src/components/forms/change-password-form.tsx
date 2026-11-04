'use client';

import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

type State = { kind: 'idle' | 'pending' | 'done' } | { kind: 'error'; message: string };

export function ChangePasswordForm() {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setState({ kind: 'pending' });
    const result = await send('POST', '/api/v1/auth/password', {
      currentPassword: form.get('currentPassword'),
      newPassword: form.get('newPassword'),
    });
    if (result.ok) {
      formElement.reset();
      setState({ kind: 'done' });
    } else {
      setState({ kind: 'error', message: errorMessage(result.code) });
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="flex max-w-sm flex-col gap-4"
    >
      {state.kind === 'done' ? <Alert tone="success">{t.account.changed}</Alert> : null}
      {state.kind === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        label={t.account.currentPassword}
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
      />
      <TextField
        label={t.account.newPassword}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={10}
        hint={t.reset.passwordHint}
        required
      />
      <Button type="submit" disabled={state.kind === 'pending'} className="self-start">
        {t.account.submit}
      </Button>
    </form>
  );
}
