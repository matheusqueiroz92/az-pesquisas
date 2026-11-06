'use client';

import { AUDIO_MODES, GPS_MODES, SURVEY_TYPES } from '@az-pesquisas/contracts';
import type { SurveyType, SurveyView } from '@az-pesquisas/contracts';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import type { ReactNode, SubmitEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField, TextField } from '@/components/ui/field';
import { errorMessage, t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';
import { centsToInput, formText, surveyBodyFrom } from '@/lib/survey-form';

import { MunicipalityPicker } from './municipality-picker';

const F = t.surveys.fields;

const TYPE_OPTIONS = SURVEY_TYPES.map((type) => ({ value: type, label: t.surveyTypes[type] }));
const GPS_OPTIONS = GPS_MODES.map((mode) => ({ value: mode, label: t.gpsModes[mode] }));
const AUDIO_OPTIONS = AUDIO_MODES.map((mode) => ({ value: mode, label: t.audioModes[mode] }));

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <Card>
      <section aria-labelledby={id} className="flex flex-col gap-5">
        <h2 id={id} className="text-lg font-bold tracking-tight">
          {title}
        </h2>
        {children}
      </section>
    </Card>
  );
}

function TextArea({
  label,
  hint,
  name,
  defaultValue,
  maxLength,
}: {
  label: string;
  hint: string;
  name: string;
  defaultValue: string;
  maxLength: number;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={3}
        maxLength={maxLength}
        defaultValue={defaultValue}
        aria-describedby={`${id}-hint`}
        className="w-full rounded-sm border border-border-strong bg-surface px-3.5 py-2.5 text-base hover:border-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30 disabled:bg-muted disabled:text-muted-foreground"
      />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

/** Create and edit form of a survey (spec 013). An archived survey is read-only. */
export function SurveyForm({
  survey,
  clients,
}: {
  survey?: SurveyView;
  clients: readonly { id: string; name: string }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<SurveyType>(survey?.type ?? 'municipal_evaluation');
  const [tseRegistered, setTseRegistered] = useState(survey ? survey.tse !== null : false);
  const [municipalityCodes, setMunicipalityCodes] = useState<number[]>(
    survey ? [...survey.municipalityCodes] : [],
  );
  const [error, setError] = useState<{ message: string; fields: string[] }>();
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const readOnly = survey?.status === 'archived';
  const invalid = (field: string) =>
    error?.fields.some((f) => f === field || f.startsWith(`${field}.`)) === true;

  const clientOptions = [
    { value: '', label: t.surveys.ownSurvey },
    ...clients.map((client) => ({ value: client.id, label: client.name })),
  ];

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const built = surveyBodyFrom((name) => formText(data, name), {
      type,
      tseRegistered,
      municipalityCodes,
    });
    setSaved(false);
    if (!built.ok) {
      setError({ message: F.invalidMoney, fields: [built.field] });
      return;
    }
    setPending(true);
    setError(undefined);
    const result = survey
      ? await send<SurveyView>('PATCH', `/api/v1/surveys/${survey.id}`, built.body)
      : await send<SurveyView>('POST', '/api/v1/surveys', built.body);
    setPending(false);
    if (result.ok) {
      if (survey) {
        setSaved(true);
        router.refresh();
      } else {
        router.push(`/pesquisas/${result.data.id}`);
      }
      return;
    }
    if (result.status === 401) {
      window.location.assign('/login');
      return;
    }
    setError({ message: errorMessage(result.code), fields: result.fields });
  };

  const tse = survey?.tse;

  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="flex flex-col gap-6"
    >
      {readOnly ? <Alert tone="info">{t.surveys.archivedNotice}</Alert> : null}
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {saved ? <Alert tone="success">{t.surveys.saved}</Alert> : null}

      <fieldset disabled={readOnly || pending} className="flex flex-col gap-6">
        <Section title={t.surveys.sections.identification}>
          <TextField
            label={F.title}
            name="title"
            defaultValue={survey?.title}
            required
            minLength={3}
            maxLength={160}
            invalid={invalid('title')}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label={F.type}
              name="type"
              options={TYPE_OPTIONS}
              value={type}
              onChange={(event) => {
                setType(event.target.value as SurveyType);
              }}
            />
            <SelectField
              label={F.client}
              name="clientId"
              options={clientOptions}
              defaultValue={survey?.clientId ?? ''}
            />
          </div>
        </Section>

        <Section title={t.surveys.sections.field}>
          <div className="grid gap-5 md:grid-cols-3">
            <TextField
              label={F.fieldStart}
              name="fieldStart"
              type="date"
              defaultValue={survey?.fieldStart ?? ''}
              invalid={invalid('fieldStart')}
            />
            <TextField
              label={F.fieldEnd}
              name="fieldEnd"
              type="date"
              defaultValue={survey?.fieldEnd ?? ''}
              invalid={invalid('fieldEnd')}
            />
            <TextField
              label={F.target}
              name="targetInterviews"
              type="number"
              min={1}
              max={1_000_000}
              step={1}
              inputMode="numeric"
              defaultValue={survey?.targetInterviews ?? ''}
              hint={F.targetHint}
              invalid={invalid('targetInterviews')}
            />
          </div>
        </Section>

        <Section title={t.surveys.sections.municipalities}>
          <p className="-mt-2 text-sm text-muted-foreground">{F.municipalitiesHint}</p>
          <MunicipalityPicker
            value={municipalityCodes}
            onChange={setMunicipalityCodes}
            disabled={readOnly}
            invalid={invalid('municipalityCodes')}
          />
        </Section>

        <Section title={t.surveys.sections.collection}>
          <div className="grid gap-5 md:grid-cols-3">
            <SelectField
              label={F.gps}
              name="gps"
              options={GPS_OPTIONS}
              defaultValue={survey?.settings.gps ?? 'optional'}
            />
            <SelectField
              label={F.audio}
              name="audio"
              options={AUDIO_OPTIONS}
              defaultValue={survey?.settings.audio ?? 'off'}
            />
            <TextField
              label={F.minDuration}
              name="minDurationMin"
              type="number"
              min={0}
              max={120}
              step={1}
              inputMode="numeric"
              defaultValue={survey ? Math.round(survey.settings.minDurationSec / 60) : 0}
              invalid={invalid('settings.minDurationSec')}
            />
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            {F.gpsHint} {F.minDurationHint}
          </p>
          <TextArea
            label={F.consent}
            hint={F.consentHint}
            name="consentText"
            maxLength={2000}
            defaultValue={survey?.settings.consentText ?? ''}
          />
        </Section>

        {type === 'electoral' ? (
          <Section title={t.surveys.sections.tse}>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={tseRegistered}
                onChange={(event) => {
                  setTseRegistered(event.target.checked);
                }}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="font-semibold">{F.tseRegistered}</span>
                <span className="block text-muted-foreground">{F.tseRegisteredHint}</span>
              </span>
            </label>
            {tseRegistered ? (
              <div className="grid gap-5 md:grid-cols-2">
                <TextField
                  label={F.registrationNumber}
                  name="registrationNumber"
                  defaultValue={tse?.registrationNumber ?? ''}
                  hint={F.registrationNumberHint}
                  invalid={invalid('tse.registrationNumber')}
                />
                <TextField
                  label={F.contractorName}
                  name="contractorName"
                  defaultValue={tse?.contractorName ?? ''}
                  maxLength={160}
                />
                <TextField
                  label={F.statisticianName}
                  name="statisticianName"
                  defaultValue={tse?.statisticianName ?? ''}
                  maxLength={120}
                />
                <TextField
                  label={F.statisticianConre}
                  name="statisticianConre"
                  defaultValue={tse?.statisticianConre ?? ''}
                  maxLength={40}
                />
                <TextField
                  label={F.contractValue}
                  name="contractValue"
                  inputMode="decimal"
                  defaultValue={centsToInput(tse?.contractValueCents ?? null)}
                  hint={F.contractValueHint}
                  invalid={invalid('tse.contractValueCents')}
                />
              </div>
            ) : null}
          </Section>
        ) : null}
      </fieldset>

      {readOnly ? null : (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {survey ? t.surveys.saveChanges : t.surveys.create}
          </Button>
        </div>
      )}
    </form>
  );
}
