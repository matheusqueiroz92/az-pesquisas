import { currentOrganizationId } from '../../../../shared/tenancy/tenant-context.js';
import { Client } from '../../domain/client.js';
import type { QuestionnaireVersion } from '../../domain/publication.js';
import { Questionnaire } from '../../domain/questionnaire.js';
import type { QuestionnaireSnapshotState } from '../../domain/questionnaire.js';
import type { ClientSnapshot } from '../../domain/client.js';
import { Survey } from '../../domain/survey.js';
import type { SurveySnapshot } from '../../domain/survey.js';
import type { Actor, AuditAction } from '../ports.js';
import type { SurveysDeps } from '../surveys-deps.js';

/**
 * In-memory doubles for the surveys ports. Every read filters by the current
 * TenantContext, so the fakes behave like RLS does.
 */
class Table<S extends { id: string; organizationId: string }> {
  rows = new Map<string, S>();

  visible(): S[] {
    const org = currentOrganizationId();
    return [...this.rows.values()].filter((r) => r.organizationId === org);
  }

  get(id: string): S | undefined {
    const row = this.rows.get(id);
    return row && row.organizationId === currentOrganizationId() ? row : undefined;
  }

  put(row: S): void {
    if (row.organizationId !== currentOrganizationId()) {
      throw new Error('fake RLS: row of another organization');
    }
    this.rows.set(row.id, row);
  }

  delete(id: string): void {
    if (this.get(id)) {
      this.rows.delete(id);
    }
  }
}

export interface AuditEntry {
  organizationId: string;
  action: AuditAction;
  actorUserId: string | null;
  entityId: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export const ORG_A = '0193a000-0000-7000-8000-00000000a000';
export const ORG_B = '0193a000-0000-7000-8000-00000000b000';

export const actorOf = (role: Actor['role'], organizationId: string = ORG_A): Actor => ({
  userId: `0193a000-0000-7000-8000-0000000000${role === 'admin' ? 'a1' : 'c9'}`,
  organizationId,
  role,
  sessionId: 'no-session',
});

export const createFakes = (options: { now?: Date } = {}) => {
  let now = options.now ?? new Date('2026-11-05T12:00:00Z');
  let idCounter = 0;
  const clients = new Table<ClientSnapshot>();
  const surveys = new Table<SurveySnapshot>();
  // Keyed by survey id, like the table (survey_id is the primary key).
  const questionnaires = new Table<QuestionnaireSnapshotState & { id: string }>();
  const versions = new Table<QuestionnaireVersion>();
  const ofSurvey = (surveyId: string) =>
    versions
      .visible()
      .filter((v) => v.surveyId === surveyId)
      .sort((a, b) => b.number - a.number);
  const auditEntries: AuditEntry[] = [];
  const locks: string[] = [];

  const deps: SurveysDeps = {
    clients: {
      findById: (id, opts) => {
        if (opts?.forUpdate) {
          locks.push(id);
        }
        const row = clients.get(id);
        return Promise.resolve(row ? Client.fromSnapshot(row) : undefined);
      },
      list: () =>
        Promise.resolve(
          clients
            .visible()
            .map((r) => Client.fromSnapshot(r))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        ),
      add: (client) => {
        clients.put(client.toSnapshot());
        return Promise.resolve();
      },
      save: (client) => {
        clients.put(client.toSnapshot());
        return Promise.resolve();
      },
      remove: (id) => {
        if (surveys.visible().some((s) => s.clientId === id)) {
          throw new Error('fake FK: client in use');
        }
        clients.delete(id);
        return Promise.resolve();
      },
    },
    surveys: {
      findById: (id, opts) => {
        if (opts?.forUpdate) {
          locks.push(id);
        }
        const row = surveys.get(id);
        return Promise.resolve(row ? Survey.fromSnapshot(row) : undefined);
      },
      list: () => Promise.resolve(surveys.visible().map((r) => Survey.fromSnapshot(r))),
      add: (survey) => {
        const row = survey.toSnapshot();
        // The composite FK of migration 0005: a client of this organization or none.
        if (row.clientId !== null && !clients.get(row.clientId)) {
          throw new Error('fake FK: client of another organization');
        }
        surveys.put(row);
        return Promise.resolve();
      },
      save: (survey) => {
        surveys.put(survey.toSnapshot());
        return Promise.resolve();
      },
      remove: (id) => {
        surveys.delete(id);
        questionnaires.delete(id); // ON DELETE CASCADE
        return Promise.resolve();
      },
      countByClient: () => {
        const counts = new Map<string, number>();
        for (const row of surveys.visible()) {
          if (row.clientId !== null) {
            counts.set(row.clientId, (counts.get(row.clientId) ?? 0) + 1);
          }
        }
        return Promise.resolve(counts);
      },
    },
    questionnaires: {
      find: (surveyId) => {
        const row = questionnaires.get(surveyId);
        if (!row) {
          return Promise.resolve(undefined);
        }
        const { id: _id, ...state } = row;
        return Promise.resolve(Questionnaire.fromSnapshot(state));
      },
      save: (questionnaire) => {
        const state = questionnaire.toSnapshot();
        if (!surveys.get(state.surveyId)) {
          throw new Error('fake FK: survey of another organization');
        }
        questionnaires.put({ ...state, id: state.surveyId });
        return Promise.resolve();
      },
    },
    versions: {
      latest: (surveyId) => Promise.resolve(ofSurvey(surveyId)[0]),
      list: (surveyId) => Promise.resolve(ofSurvey(surveyId)),
      findByNumber: (surveyId, number) =>
        Promise.resolve(ofSurvey(surveyId).find((v) => v.number === number)),
      add: (version) => {
        if (!surveys.get(version.surveyId)) {
          throw new Error('fake FK: survey of another organization');
        }
        if (ofSurvey(version.surveyId).some((v) => v.number === version.number)) {
          throw new Error('fake unique: version number taken');
        }
        versions.put(version);
        return Promise.resolve();
      },
    },
    tx: {
      // Commits unless the work throws, like a real transaction.
      run: async (work) => {
        currentOrganizationId();
        const backup = {
          clients: new Map(clients.rows),
          surveys: new Map(surveys.rows),
          questionnaires: new Map(questionnaires.rows),
          versions: new Map(versions.rows),
        };
        const auditLength = auditEntries.length;
        try {
          return await work();
        } catch (error) {
          clients.rows = backup.clients;
          surveys.rows = backup.surveys;
          questionnaires.rows = backup.questionnaires;
          versions.rows = backup.versions;
          auditEntries.length = auditLength;
          throw error;
        }
      },
    },
    audit: {
      record: (entry) => {
        auditEntries.push({ organizationId: currentOrganizationId(), ...entry });
        return Promise.resolve();
      },
    },
    clock: { now: () => now },
    ids: {
      next: () => {
        idCounter += 1;
        return `0193a000-0000-7000-8000-${String(idCounter).padStart(12, '0')}`;
      },
    },
  };

  return {
    deps,
    tables: { clients, surveys, questionnaires, versions },
    auditEntries,
    locks,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
};

export type Fakes = ReturnType<typeof createFakes>;
