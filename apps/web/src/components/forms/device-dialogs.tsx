'use client';

import type { DeviceView, PairingCreated, PairingStatus } from '@az-pesquisas/contracts';
import { Ban, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField } from '@/components/ui/field';
import { errorMessage, t } from '@/i18n/pt-BR';
import { formatPairingCode } from '@/lib/format';
import { send } from '@/lib/http';
import { formText } from '@/lib/survey-form';

import { DialogActions } from './dialog-actions';
import { useSubmit } from './use-submit';

const D = t.devices;
const POLL_MS = 3000;

/** Generates a 6-digit code and watches until a device uses it (spec 016 rule 2). */
export function PairDeviceButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pairing, setPairing] = useState<PairingCreated>();
  const [status, setStatus] = useState<PairingStatus>();
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => Date.now());
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const stop = () => {
    clearInterval(timer.current);
    timer.current = undefined;
  };

  const start = async () => {
    stop();
    setError(undefined);
    setStatus(undefined);
    setPairing(undefined);
    const created = await send<PairingCreated>('POST', '/api/v1/devices/pairings');
    if (!created.ok) {
      setError(errorMessage(created.code));
      return;
    }
    setPairing(created.data);
    timer.current = setInterval(() => {
      setNow(Date.now());
      void (async () => {
        const polled = await send<PairingStatus>(
          'GET',
          `/api/v1/devices/pairings/${created.data.id}`,
        );
        if (polled.ok) {
          setStatus(polled.data);
          if (polled.data.status !== 'pending') {
            stop();
            router.refresh();
          }
        }
      })();
    }, POLL_MS);
  };

  useEffect(() => stop, []);

  const close = () => {
    stop();
    setOpen(false);
  };

  const left = pairing ? Math.max(0, new Date(pairing.expiresAt).getTime() - now) : 0;
  const state = status?.status ?? 'pending';

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          void start();
        }}
      >
        <Plus aria-hidden />
        {D.pair}
      </Button>
      <Dialog open={open} title={D.pairTitle} onClose={close}>
        <div className="flex flex-col gap-5" data-testid="pair-dialog">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {pairing && state === 'pending' ? (
            <>
              <p className="text-sm">{D.pairSteps}</p>
              <p
                data-testid="pairing-code"
                className="text-center font-mono text-5xl font-bold tracking-[0.2em] tabular"
              >
                {formatPairingCode(pairing.code)}
              </p>
              <p className="text-center text-sm text-muted-foreground" aria-live="polite">
                {D.waiting}{' '}
                {D.expiresIn(Math.floor(left / 60_000), Math.floor((left % 60_000) / 1000))}
              </p>
            </>
          ) : null}
          {state === 'paired' && status?.device ? (
            <Alert tone="success">{D.paired(status.device.nickname, status.device.model)}</Alert>
          ) : null}
          {state === 'expired' ? <Alert tone="error">{D.expired}</Alert> : null}
          <div className="flex justify-end gap-2">
            {state === 'expired' ? (
              <Button
                variant="secondary"
                onClick={() => {
                  void start();
                }}
              >
                {D.again}
              </Button>
            ) : null}
            <Button variant={state === 'paired' ? 'primary' : 'secondary'} onClick={close}>
              {D.close}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function RenameDeviceButton({ device }: { device: DeviceView }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  const { submit, error, pending } = useSubmit(close);
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nickname = formText(new FormData(event.currentTarget), 'nickname');
    void submit(() => send('PATCH', `/api/v1/devices/${device.id}`, { nickname }));
  };
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${D.rename} ${device.nickname}`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Pencil aria-hidden />
      </Button>
      <Dialog open={open} title={`${D.rename}: ${device.nickname}`} onClose={close}>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error.message}</Alert> : null}
          <TextField
            label={D.nickname}
            name="nickname"
            defaultValue={device.nickname}
            required
            minLength={2}
            maxLength={60}
            invalid={error?.fields.includes('nickname') === true}
          />
          <DialogActions pending={pending} onCancel={close} />
        </form>
      </Dialog>
    </>
  );
}

export function RevokeDeviceButton({ device }: { device: DeviceView }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
  };
  const { submit, error, pending } = useSubmit(close);
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(() => send('POST', `/api/v1/devices/${device.id}/revoke`));
  };
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${D.revoke} ${device.nickname}`}
        onClick={() => {
          setOpen(true);
        }}
      >
        <Ban aria-hidden />
      </Button>
      <Dialog
        open={open}
        title={D.revokeTitle(device.nickname)}
        description={D.revokeBody}
        onClose={close}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          {error ? <Alert tone="error">{error.message}</Alert> : null}
          <DialogActions pending={pending} onCancel={close} submitLabel={D.revoke} danger />
        </form>
      </Dialog>
    </>
  );
}
