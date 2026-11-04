import type { Metadata } from 'next';

import { ForgotPasswordForm } from '@/components/forms/forgot-password-form';
import { t } from '@/i18n/pt-BR';

export const metadata: Metadata = { title: t.forgot.title };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
