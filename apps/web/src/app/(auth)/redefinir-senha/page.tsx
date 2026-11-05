import type { Metadata } from 'next';
import Link from 'next/link';

import { ResetPasswordForm } from '@/components/forms/reset-password-form';
import { Alert } from '@/components/ui/alert';
import { t } from '@/i18n/pt-BR';

export const metadata: Metadata = { title: t.reset.title };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  if (typeof token !== 'string' || token.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="error">{t.reset.missingToken}</Alert>
        <Link
          href="/esqueci-senha"
          className="self-start text-sm font-semibold text-link underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          {t.login.forgot}
        </Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
