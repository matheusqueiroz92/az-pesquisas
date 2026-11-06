'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { t } from '@/i18n/pt-BR';

export function PrintButton() {
  return (
    <Button
      onClick={() => {
        window.print();
      }}
    >
      <Printer aria-hidden />
      {t.versions.print}
    </Button>
  );
}
