import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';
import type { DraftQuestion, QuestionnaireDraft } from '@az-pesquisas/contracts';

export interface QuestionnaireSnapshotState {
  readonly surveyId: string;
  readonly organizationId: string;
  /** 0 = never saved. */
  readonly revision: number;
  readonly content: QuestionnaireDraft;
  readonly updatedAt: Date | null;
  readonly updatedBy: string | null;
}

const withNewIds = (question: DraftQuestion, newId: () => string): DraftQuestion => {
  const copy = { ...question, id: newId() };
  if ('options' in copy) {
    copy.options = copy.options.map((option) => ({ ...option, id: newId() }));
  }
  if ('rows' in copy) {
    copy.rows = copy.rows.map((row) => ({ ...row, id: newId() }));
  }
  return copy;
};

/**
 * The questionnaire DRAFT of one survey (spec 014): one document, saved whole,
 * with a revision number against lost updates (ADR-0014).
 */
export class Questionnaire {
  private constructor(private state: QuestionnaireSnapshotState) {}

  static empty(surveyId: string, organizationId: string): Questionnaire {
    return new Questionnaire({
      surveyId,
      organizationId,
      revision: 0,
      content: { introText: null, questions: [] },
      updatedAt: null,
      updatedBy: null,
    });
  }

  static fromSnapshot(snapshot: QuestionnaireSnapshotState): Questionnaire {
    return new Questionnaire({ ...snapshot });
  }

  toSnapshot(): QuestionnaireSnapshotState {
    return { ...this.state };
  }

  get revision(): number {
    return this.state.revision;
  }

  get questionCount(): number {
    return this.state.content.questions.length;
  }

  /** Saves a new content if the editor started from the current revision. */
  replace(
    content: QuestionnaireDraft,
    input: { expectedRevision: number; now: Date; by: string },
  ): Result<void, 'QUESTIONNAIRE_CONFLICT'> {
    if (input.expectedRevision !== this.state.revision) {
      return err('QUESTIONNAIRE_CONFLICT');
    }
    this.state = {
      ...this.state,
      content,
      revision: this.state.revision + 1,
      updatedAt: input.now,
      updatedBy: input.by,
    };
    return ok(undefined);
  }

  /**
   * The draft of a duplicated survey: same questions, new ids (the copy is
   * another survey; ids are stable only inside one survey).
   */
  copyFor(input: { surveyId: string; now: Date; by: string; newId: () => string }): Questionnaire {
    return new Questionnaire({
      surveyId: input.surveyId,
      organizationId: this.state.organizationId,
      revision: 1,
      content: {
        introText: this.state.content.introText,
        questions: this.state.content.questions.map((q) => withNewIds(q, input.newId)),
      },
      updatedAt: input.now,
      updatedBy: input.by,
    });
  }
}
