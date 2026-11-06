'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { errorMessage } from '@/i18n/pt-BR';
import type { SendResult } from '@/lib/http';

/** Shared submit flow: send, refresh the server-rendered list, close. */
export const useSubmit = <T = unknown>(onDone: (data: T) => void) => {
  const router = useRouter();
  const [error, setError] = useState<{ message: string; fields: string[] }>();
  const [pending, setPending] = useState(false);

  const submit = async (call: () => Promise<SendResult<T>>) => {
    setPending(true);
    setError(undefined);
    const result = await call();
    setPending(false);
    if (result.ok) {
      onDone(result.data);
      router.refresh();
      return;
    }
    if (result.status === 401) {
      window.location.assign('/login');
      return;
    }
    setError({ message: errorMessage(result.code), fields: result.fields });
  };
  return { submit, error, pending };
};
