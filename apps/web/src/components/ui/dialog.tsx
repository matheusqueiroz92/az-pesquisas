'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** Native <dialog>: focus trap, Esc and backdrop come from the browser. */
export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog?.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl"
    >
      <h2 id="dialog-title" className="mb-4 text-lg font-semibold">
        {title}
      </h2>
      {open ? children : null}
    </dialog>
  );
}
