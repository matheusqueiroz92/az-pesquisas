'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<
    { kind: 'idle' | 'pending' | 'done' } | { kind: 'error'; message: string }
  >({
    kind: 'idle',
  });

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = form.get('newPassword');
    if (newPassword !== form.get('confirm')) {
      setState({ kind: 'error', message: t.reset.mismatch });
      return;
    }
    setState({ kind: 'pending' });
    const result = await send('POST', '/api/auth/password-reset/confirm', { token, newPassword });
    setState(result.ok ? { kind: 'done' } : { kind: 'error', message: errorMessage(result.code) });
  };

  if (state.kind === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">{t.reset.done}</Alert>
        <Link href="/login" className="text-center text-sm text-brand-700 underline">
          {t.forgot.back}
        </Link>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="text-lg font-semibold">{t.reset.title}</h1>
      {state.kind === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
      <TextField
        label={t.reset.newPassword}
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={10}
        hint={t.reset.passwordHint}
        required
      />
      <TextField
        label={t.reset.confirm}
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <Button type="submit" disabled={state.kind === 'pending'}>
        {t.reset.submit}
      </Button>
    </form>
  );
}
