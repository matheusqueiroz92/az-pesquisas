'use client';

import { ROLES, USER_STATUSES } from '@az-pesquisas/contracts';
import type { UserView } from '@az-pesquisas/contracts';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

import { DialogActions } from './dialog-actions';
import { useSubmit } from './use-submit';

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: t.roles[role] }));
const STATUS_OPTIONS = USER_STATUSES.map((status) => ({
  value: status,
  label: t.statuses[status],
}));

export function NewUserButton() {
  const [open, setOpen] = useState(false);
  const { submit, error, pending } = useSubmit(() => {
    setOpen(false);
  });

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void submit(() =>
      send('POST', '/api/v1/users', {
        name: form.get('name'),
        email: form.get('email'),
        role: form.get('role'),
        password: form.get('password'),
      }),
    );
  };

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        <Plus aria-hidden />
        {t.users.new}
      </Button>
      <Dialog
        open={open}
        title={t.users.new}
        onClose={() => {
          setOpen(false);
        }}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error.message}</Alert> : null}
          <TextField
            label={t.users.name}
            name="name"
            required
            minLength={2}
            invalid={error?.fields.includes('name')}
          />
          <TextField
            label={t.users.email}
            name="email"
            type="email"
            required
            invalid={error?.fields.includes('email')}
          />
          <SelectField
            label={t.users.role}
            name="role"
            options={ROLE_OPTIONS}
            defaultValue="interviewer"
          />
          <TextField
            label={t.users.initialPassword}
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            hint={t.users.initialPasswordHint}
            required
            invalid={error?.fields.includes('password')}
          />
          <DialogActions
            pending={pending}
            onCancel={() => {
              setOpen(false);
            }}
          />
        </form>
      </Dialog>
    </>
  );
}

export function EditUserButton({ user, isSelf }: { user: UserView; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const { submit, error, pending } = useSubmit(() => {
    setOpen(false);
  });

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const changes: Record<string, FormDataEntryValue> = {};
    for (const field of ['name', 'role', 'status'] as const) {
      const value = form.get(field);
      if (value !== null && value !== user[field]) {
        changes[field] = value;
      }
    }
    if (Object.keys(changes).length === 0) {
      setOpen(false);
      return;
    }
    void submit(() => send('PATCH', `/api/v1/users/${user.id}`, changes));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true);
        }}
        aria-label={`${t.users.edit} ${user.name}`}
      >
        <Pencil aria-hidden />
        <span className="hidden md:inline">{t.users.edit}</span>
      </Button>
      <Dialog
        open={open}
        title={`${t.users.edit}: ${user.name}`}
        onClose={() => {
          setOpen(false);
        }}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error.message}</Alert> : null}
          <TextField
            label={t.users.name}
            name="name"
            defaultValue={user.name}
            required
            minLength={2}
          />
          {/* The API refuses self-demotion and self-disabling too (spec 006); hiding avoids the error. */}
          <SelectField
            label={t.users.role}
            name="role"
            options={ROLE_OPTIONS}
            defaultValue={user.role}
            disabled={isSelf}
          />
          <SelectField
            label={t.users.status}
            name="status"
            options={STATUS_OPTIONS}
            defaultValue={user.status}
            disabled={isSelf}
          />
          <DialogActions
            pending={pending}
            onCancel={() => {
              setOpen(false);
            }}
          />
        </form>
      </Dialog>
    </>
  );
}
