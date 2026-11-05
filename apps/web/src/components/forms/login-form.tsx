'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

export function LoginForm() {
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(undefined);
    const result = await send('POST', '/api/auth/login', {
      email: form.get('email'),
      password: form.get('password'),
    });
    if (result.ok) {
      // Full navigation: the next request goes through proxy.ts with the new cookies.
      window.location.assign('/');
      return;
    }
    setPending(false);
    // Rule 7: always generic. Wrong e-mail, wrong password and locked account look the same.
    setError(errorMessage(result.status === 400 ? 'INVALID_CREDENTIALS' : result.code));
  };

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="flex flex-col gap-5"
      noValidate={false}
    >
      <div className="mb-2">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.login.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.login.subtitle}</p>
      </div>
      {error ? (
        <Alert tone="error">
          <p>{error}</p>
          <p className="mt-1 text-xs">{t.login.lockoutHint}</p>
        </Alert>
      ) : null}
      <TextField label={t.login.email} name="email" type="email" autoComplete="username" required />
      <TextField
        label={t.login.password}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? t.login.submitting : t.login.submit}
      </Button>
      <Link
        href="/esqueci-senha"
        className="self-start text-sm font-semibold text-link underline decoration-1 underline-offset-4 hover:decoration-2"
      >
        {t.login.forgot}
      </Link>
    </form>
  );
}
