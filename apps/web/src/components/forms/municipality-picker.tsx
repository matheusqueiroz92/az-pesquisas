'use client';

import { HOME_UF, MUNICIPALITIES, STATES } from '@az-pesquisas/contracts';
import type { Uf } from '@az-pesquisas/contracts';
import { Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { t } from '@/i18n/pt-BR';
import { foldText, municipalityLabel } from '@/lib/surveys';

const INDEX = MUNICIPALITIES.map((m) => ({ ...m, folded: foldText(m.name) }));

/**
 * Searchable checklist of the municipalities of one state (Bahia first; any
 * state can be picked, spec 013 change 1). Chosen ones become chips.
 */
export function MunicipalityPicker({
  value,
  onChange,
  disabled = false,
  invalid = false,
}: {
  value: readonly number[];
  onChange: (codes: number[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [uf, setUf] = useState<Uf>(HOME_UF);
  const searchId = useId();
  const ufId = useId();
  const chosen = useMemo(() => new Set(value), [value]);
  const matches = useMemo(() => {
    const folded = foldText(query);
    return INDEX.filter((m) => m.uf === uf && (folded === '' || m.folded.includes(folded)));
  }, [query, uf]);

  const toggle = (code: number) => {
    onChange(chosen.has(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  return (
    <div
      className="flex flex-col gap-3"
      aria-invalid={invalid ? true : undefined}
      data-testid="municipality-picker"
    >
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {t.surveys.fields.municipalitySelected(value.length)}
        </span>
        {value.map((code) => {
          const name = municipalityLabel(code);
          return (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-pill bg-muted py-1 pr-1 pl-3 text-sm font-semibold"
            >
              {name}
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  toggle(code);
                }}
                aria-label={t.surveys.fields.municipalityRemove(name)}
                className="grid size-6 place-items-center rounded-pill text-muted-foreground hover:bg-border hover:text-foreground disabled:pointer-events-none"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </span>
          );
        })}
        {value.length > 1 && !disabled ? (
          <button
            type="button"
            onClick={() => {
              onChange([]);
            }}
            className="text-sm font-semibold text-link hover:underline"
          >
            {t.surveys.fields.municipalityClear}
          </button>
        ) : null}
      </div>
      {disabled ? null : (
        <div
          className={
            invalid ? 'rounded-sm border border-error' : 'rounded-sm border border-border-strong'
          }
        >
          <div className="flex border-b border-border">
            <label htmlFor={ufId} className="sr-only">
              {t.surveys.fields.municipalityState}
            </label>
            <select
              id={ufId}
              value={uf}
              onChange={(event) => {
                setUf(event.target.value as Uf);
              }}
              title={t.surveys.fields.municipalityState}
              className="h-11 shrink-0 rounded-tl-sm border-r border-border bg-surface-sunken/60 px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring/30"
            >
              {STATES.map((state) => (
                <option key={state.uf} value={state.uf}>
                  {state.uf}
                </option>
              ))}
            </select>
            <div className="relative flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <label htmlFor={searchId} className="sr-only">
                {t.surveys.fields.municipalitySearch}
              </label>
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  // Enter picks the only match instead of submitting the whole form.
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const only = matches.length === 1 ? matches[0] : undefined;
                    if (only && !chosen.has(only.code)) {
                      toggle(only.code);
                      setQuery('');
                    }
                  }
                }}
                placeholder={t.surveys.fields.municipalitySearch}
                className="h-11 w-full rounded-tr-sm bg-surface pr-3 pl-9 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring/30"
              />
            </div>
          </div>
          <ul
            className="max-h-56 overflow-y-auto py-1"
            aria-label={t.surveys.sections.municipalities}
          >
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {t.surveys.fields.municipalityNone}
              </li>
            ) : (
              matches.map((m) => (
                <li key={m.code}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 px-3 text-sm hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={chosen.has(m.code)}
                      onChange={() => {
                        toggle(m.code);
                      }}
                      className="size-4 accent-primary"
                    />
                    {m.name}
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
