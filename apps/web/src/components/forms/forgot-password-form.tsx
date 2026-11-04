'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

export function ForgotPasswordForm() {
  const [state, setState] = useState<
    { kind: 'idle' | 'pending' | 'sent' } | { kind: 'error'; message: string }
  >({
    kind: 'idle',
  });

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState({ kind: 'pending' });
    const result = await send('POST', '/api/auth/password-reset', { email: form.get('email') });
    // The API answers 202 whether or not the e-mail exists (no account enumeration).
    setState(result.ok ? { kind: 'sent' } : { kind: 'error', message: errorMessage(result.code) });
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t.forgot.title}</h1>
      {state.kind === 'sent' ? (
        <Alert tone="success">{t.forgot.sent}</Alert>
      ) : (
        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-sm text-slate-600">{t.forgot.intro}</p>
          {state.kind === 'error' ? <Alert tone="error">{state.message}</Alert> : null}
          <TextField
            label={t.login.email}
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <Button type="submit" disabled={state.kind === 'pending'}>
            {t.forgot.submit}
          </Button>
        </form>
      )}
      <Link href="/login" className="text-center text-sm text-brand-700 underline">
        {t.forgot.back}
      </Link>
    </div>
  );
}
