'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

interface DialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/** Native <dialog>: focus trap, Esc and backdrop come from the browser. */
export function Dialog({ open, title, description, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-md border border-border bg-surface p-0 text-foreground shadow-dialog"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 id={titleId} className="text-lg font-bold tracking-tight">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="-mr-2 grid size-9 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="px-6 py-5">{open ? children : null}</div>
    </dialog>
  );
}
