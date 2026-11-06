'use client';

import { lintQuestionnaire, QUESTION_TYPES } from '@az-pesquisas/contracts';
import type {
  LintIssue,
  QuestionnaireDraft,
  QuestionnaireView,
  QuestionType,
} from '@az-pesquisas/contracts';
import { AlertTriangle, Check, CircleAlert, Loader2, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { v7 as uuidv7 } from 'uuid';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { t } from '@/i18n/pt-BR';
import { send } from '@/lib/http';
import { editorReducer, newQuestion, nextQuestionCode } from '@/lib/questionnaire-editor';
import type { EditorAction } from '@/lib/questionnaire-editor';

import { TextAreaField } from './fields';
import { PhonePreview } from './phone-preview';
import { QuestionForm } from './question-form';
import { QuestionList } from './question-list';

const Q = t.questionnaire;
const AUTOSAVE_MS = 1200;
const newId = () => uuidv7();

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

function StatusLine({ status }: { status: SaveStatus }) {
  const icons = {
    saved: <Check aria-hidden className="size-4 text-success" />,
    dirty: <CircleAlert aria-hidden className="size-4 text-muted-foreground" />,
    saving: <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />,
    error: <AlertTriangle aria-hidden className="size-4 text-error" />,
    conflict: <AlertTriangle aria-hidden className="size-4 text-error" />,
  };
  return (
    <p
      role="status"
      data-testid="save-status"
      data-status={status}
      className="flex items-center gap-1.5 text-sm text-muted-foreground"
    >
      {icons[status]}
      {status === 'conflict' ? Q.status.dirty : Q.status[status]}
    </p>
  );
}

function IssueList({
  issues,
  codeOf,
  onSelect,
}: {
  issues: readonly LintIssue[];
  codeOf: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  if (issues.length === 0) {
    return (
      <p data-testid="issues" className="flex items-center gap-2 text-sm text-success-foreground">
        <Check aria-hidden className="size-4" />
        {Q.issues.none}
      </p>
    );
  }
  return (
    <details
      data-testid="issues"
      className="rounded-sm border border-warning bg-warning-soft/50 p-3"
    >
      <summary className="cursor-pointer text-sm font-semibold text-warning-foreground">
        {Q.issues.title(issues.length)}
      </summary>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.code}-${issue.questionId ?? ''}-${String(index)}`}>
            {issue.questionId ? (
              <button
                type="button"
                className="font-mono font-semibold text-link hover:underline"
                onClick={() => {
                  if (issue.questionId) {
                    onSelect(issue.questionId);
                  }
                }}
              >
                {codeOf(issue.questionId) || '—'}
              </button>
            ) : null}{' '}
            {t.lint[issue.code]}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The questionnaire editor of one survey (spec 014). */
export function QuestionnaireEditor({ initial }: { initial: QuestionnaireView }) {
  const surveyId = initial.surveyId;
  const readOnly = initial.lock !== null;
  const [draft, setDraft] = useState<QuestionnaireDraft>(initial.content);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    initial.content.questions[0]?.id,
  );
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [newType, setNewType] = useState<QuestionType>('single_choice');

  // Refs, not state: the save loop reads the latest values without re-rendering.
  const latest = useRef(draft);
  const revision = useRef(initial.revision);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saving = useRef(false);
  const blocked = useRef(false);

  const save = async (): Promise<void> => {
    if (saving.current || blocked.current) {
      return;
    }
    saving.current = true;
    setStatus('saving');
    const content = latest.current;
    const result = await send<QuestionnaireView>(
      'PUT',
      `/api/v1/surveys/${surveyId}/questionnaire`,
      {
        revision: revision.current,
        content,
      },
    );
    saving.current = false;
    if (result.ok) {
      revision.current = result.data.revision;
      if (latest.current === content) {
        setStatus('saved');
      } else {
        // Edited while saving: save again right away.
        void save();
      }
      return;
    }
    if (result.status === 401) {
      window.location.assign('/login');
      return;
    }
    if (result.code === 'QUESTIONNAIRE_CONFLICT') {
      blocked.current = true;
      setStatus('conflict');
    } else {
      setStatus('error');
    }
  };

  const edit = (action: EditorAction) => {
    if (readOnly || blocked.current) {
      return;
    }
    const next = editorReducer(latest.current, action);
    latest.current = next;
    setDraft(next);
    setStatus('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void save();
    }, AUTOSAVE_MS);
  };

  // Leaving with unsaved changes asks first (spec 014 rule 12).
  useEffect(() => {
    if (status === 'saved') {
      return undefined;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
    };
  }, [status]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  const issues = useMemo(() => lintQuestionnaire(draft), [draft]);
  const issueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      if (issue.questionId) {
        counts.set(issue.questionId, (counts.get(issue.questionId) ?? 0) + 1);
      }
    }
    return counts;
  }, [issues]);

  const selectedIndex = draft.questions.findIndex((q) => q.id === selectedId);
  const selected = draft.questions[selectedIndex];
  const codeOf = (id: string) => draft.questions.find((q) => q.id === id)?.code ?? '';

  const addQuestion = () => {
    const question = newQuestion(newType, nextQuestionCode(latest.current.questions), newId);
    const index = selectedIndex < 0 ? latest.current.questions.length : selectedIndex + 1;
    edit({ type: 'insert', question, index });
    setSelectedId(question.id);
  };

  const removeSelected = () => {
    if (!selected || !window.confirm(Q.removeConfirm(selected.code))) {
      return;
    }
    const neighbor = draft.questions[selectedIndex + 1] ?? draft.questions[selectedIndex - 1];
    edit({ type: 'remove', id: selected.id });
    setSelectedId(neighbor?.id);
  };

  const duplicateSelected = () => {
    if (!selected) {
      return;
    }
    edit({ type: 'duplicate', id: selected.id, newId });
    setSelectedId(latest.current.questions[selectedIndex + 1]?.id);
  };

  return (
    <div className="flex flex-col gap-6">
      {initial.lock ? <Alert tone="info">{Q.locks[initial.lock]}</Alert> : null}
      {status === 'conflict' ? (
        <Alert tone="error">
          <span className="flex flex-wrap items-center gap-3">
            {Q.status.conflict}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                window.location.reload();
              }}
            >
              {Q.status.reload}
            </Button>
          </span>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <IssueList issues={issues} codeOf={codeOf} onSelect={setSelectedId} />
        {readOnly ? null : <StatusLine status={status} />}
      </div>

      <fieldset disabled={readOnly || status === 'conflict'} className="contents">
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{Q.questions(draft.questions.length)}</p>
            <QuestionList
              questions={draft.questions}
              selectedId={selectedId}
              issueCounts={issueCounts}
              readOnly={readOnly}
              onSelect={setSelectedId}
              onMove={(id, to) => {
                edit({ type: 'move', id, to });
              }}
            />
            {readOnly ? null : (
              <div className="flex flex-col gap-2 rounded-sm border border-dashed border-border-strong p-3">
                <label htmlFor="new-question-type" className="text-sm font-semibold">
                  {Q.chooseType}
                </label>
                <select
                  id="new-question-type"
                  value={newType}
                  onChange={(event) => {
                    setNewType(event.target.value as QuestionType);
                  }}
                  className="h-10 rounded-sm border border-border-strong bg-surface px-2.5 text-sm"
                >
                  {QUESTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t.questionTypes[type]}
                    </option>
                  ))}
                </select>
                <Button onClick={addQuestion}>
                  <Plus aria-hidden />
                  {Q.add}
                </Button>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <TextAreaField
                label={Q.intro}
                hint={Q.introHint}
                value={draft.introText ?? ''}
                maxLength={2000}
                rows={2}
                onChange={(text) => {
                  edit({ type: 'setIntro', text });
                }}
              />
            </Card>
            {selected ? (
              <QuestionForm
                key={selected.id}
                question={selected}
                earlier={draft.questions.slice(0, selectedIndex)}
                issues={issues.filter((i) => i.questionId === selected.id)}
                newId={newId}
                edit={edit}
                onDuplicate={duplicateSelected}
                onRemove={removeSelected}
              />
            ) : (
              <p className="rounded-md border border-dashed border-border-strong p-10 text-center text-muted-foreground">
                {draft.questions.length === 0 ? Q.addFirst : Q.noSelection}
              </p>
            )}
          </div>

          <div className="hidden xl:block">
            <div className="sticky top-6">
              <PhonePreview question={selected} />
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
