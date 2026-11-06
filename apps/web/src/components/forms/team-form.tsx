'use client';

import type { SurveyTeamView } from '@az-pesquisas/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';

const T = t.team;

function Checklist({
  title,
  empty,
  items,
  chosen,
  onToggle,
  testId,
}: {
  title: string;
  empty: string;
  items: { id: string; label: string; detail: string }[];
  chosen: ReadonlySet<string>;
  onToggle: (id: string) => void;
  testId: string;
}): ReactNode {
  return (
    <Card>
      <fieldset className="flex flex-col gap-3" data-testid={testId}>
        <legend className="mb-1 flex w-full items-baseline justify-between gap-3">
          <span className="text-lg font-bold">{title}</span>
          <span className="text-sm text-muted-foreground">{T.selected(chosen.size)}</span>
        </legend>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => (
              <li key={item.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                  <input
                    type="checkbox"
                    checked={chosen.has(item.id)}
                    onChange={() => {
                      onToggle(item.id);
                    }}
                    className="size-4 accent-primary"
                  />
                  <span>
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block text-sm text-muted-foreground">{item.detail}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </Card>
  );
}

/** Devices and interviewers of a survey (spec 016 rule 10). */
export function TeamForm({
  surveyId,
  team,
  locked,
}: {
  surveyId: string;
  team: SurveyTeamView;
  locked: boolean;
}) {
  const router = useRouter();
  const [devices, setDevices] = useState(
    () => new Set(team.devices.filter((d) => d.assigned).map((d) => d.id)),
  );
  const [interviewers, setInterviewers] = useState(
    () => new Set(team.interviewers.filter((i) => i.assigned).map((i) => i.id)),
  );
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [pending, setPending] = useState(false);

  const toggle = (set: Set<string>, update: (s: Set<string>) => void) => (id: string) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    update(next);
    setMessage(undefined);
  };

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    const result = await send<SurveyTeamView>('PUT', `/api/v1/surveys/${surveyId}/team`, {
      deviceIds: [...devices],
      interviewerIds: [...interviewers],
    });
    setPending(false);
    if (result.ok) {
      setMessage({ tone: 'success', text: T.saved });
      router.refresh();
    } else {
      setMessage({ tone: 'error', text: errorMessage(result.code) });
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="flex flex-col gap-6"
    >
      <p className="max-w-2xl text-muted-foreground">{T.intro}</p>
      {locked ? <Alert tone="info">{T.locked}</Alert> : null}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <fieldset disabled={locked || pending} className="grid gap-6 lg:grid-cols-2">
        <Checklist
          title={T.devices}
          empty={T.noDevices}
          testId="team-devices"
          items={team.devices.map((d) => ({ id: d.id, label: d.nickname, detail: d.model }))}
          chosen={devices}
          onToggle={toggle(devices, setDevices)}
        />
        <Checklist
          title={T.interviewers}
          empty={T.noInterviewers}
          testId="team-interviewers"
          items={team.interviewers.map((i) => ({ id: i.id, label: i.name, detail: i.email }))}
          chosen={interviewers}
          onToggle={toggle(interviewers, setInterviewers)}
        />
      </fieldset>
      {locked ? null : (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {T.save}
          </Button>
        </div>
      )}
    </form>
  );
}
