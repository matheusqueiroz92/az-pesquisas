import {
  compareVersions,
  draftToSnapshotInput,
  isIncompatible,
  lintQuestionnaire,
  QuestionnaireSnapshot,
  TSE_REQUIRED_FIELDS,
} from '@az-pesquisas/contracts';
import type {
  LintIssue,
  QuestionnaireDraft,
  TseRequiredField,
  VersionChange,
} from '@az-pesquisas/contracts';

import type { Survey } from './survey.js';

/** A published questionnaire version: never changes (AGENTS.md rule 7). */
export interface QuestionnaireVersion {
  readonly id: string;
  readonly organizationId: string;
  readonly surveyId: string;
  readonly number: number;
  readonly snapshot: QuestionnaireSnapshot;
  /** Differences from the previous version; empty for v1. */
  readonly changes: readonly VersionChange[];
  readonly publishedAt: Date;
  readonly publishedBy: string;
}

export type PublicationBlocker =
  | 'SURVEY_NOT_EDITABLE'
  | 'QUESTIONNAIRE_NOT_PUBLISHABLE'
  | 'SURVEY_TSE_INCOMPLETE'
  | 'QUESTIONNAIRE_INCOMPATIBLE'
  | 'QUESTIONNAIRE_UNCHANGED';

export interface PublicationPlan {
  readonly nextVersionNumber: number;
  readonly issues: readonly LintIssue[];
  readonly tseMissing: readonly TseRequiredField[];
  readonly changes: readonly VersionChange[];
  /** First rule that stops the publication, or null. */
  readonly blocker: PublicationBlocker | null;
  /** The snapshot to publish, when the draft is publishable. */
  readonly snapshot: QuestionnaireSnapshot | null;
}

/** TSE data a registered electoral survey still lacks (spec 015 rule 10). */
export const missingTseFields = (survey: Survey): TseRequiredField[] => {
  const { type, tse } = survey.toSnapshot();
  if (type !== 'electoral' || tse === null) {
    return [];
  }
  return TSE_REQUIRED_FIELDS.filter((field) => tse[field] === null);
};

/**
 * Everything about publishing the draft as the next version (spec 015), with
 * no side effect: the preview shows it, the publication applies it.
 */
export const planPublication = (input: {
  survey: Survey;
  draft: QuestionnaireDraft;
  previous: QuestionnaireVersion | undefined;
  versionId: string;
}): PublicationPlan => {
  const { survey, draft, previous } = input;
  const s = survey.toSnapshot();
  const nextVersionNumber = s.publishedVersion + 1;
  const issues = lintQuestionnaire(draft);
  const tseMissing = missingTseFields(survey);

  const { consentText, ...settings } = s.settings;
  const parsed = QuestionnaireSnapshot.safeParse(
    draftToSnapshotInput(draft, {
      surveyId: s.id,
      versionId: input.versionId,
      versionNumber: nextVersionNumber,
      title: s.title,
      settings: consentText ? { ...settings, consentText } : settings,
    }),
  );
  const snapshot = parsed.success ? parsed.data : null;
  const changes = previous && snapshot ? compareVersions(previous.snapshot, snapshot) : [];

  const blocker: PublicationBlocker | null =
    s.status === 'archived'
      ? 'SURVEY_NOT_EDITABLE'
      : issues.length > 0 || !snapshot
        ? 'QUESTIONNAIRE_NOT_PUBLISHABLE'
        : tseMissing.length > 0
          ? 'SURVEY_TSE_INCOMPLETE'
          : changes.some(isIncompatible)
            ? 'QUESTIONNAIRE_INCOMPATIBLE'
            : previous && changes.length === 0
              ? 'QUESTIONNAIRE_UNCHANGED'
              : null;

  return { nextVersionNumber, issues, tseMissing, changes, blocker, snapshot };
};
