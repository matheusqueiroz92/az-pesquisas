import type { Metadata } from 'next';

import { LoginForm } from '@/components/forms/login-form';
import { t } from '@/i18n/pt-BR';

export const metadata: Metadata = { title: t.login.title };

export default function LoginPage() {
  return <LoginForm />;
}
