import { isValidTaxId } from '@az-pesquisas/contracts';

// Defensive checks: the HTTP layer validates with Zod, but the aggregate never
// holds an invalid name or document, whoever calls it.
const normalizeName = (raw: string): string => {
  const name = raw.trim();
  if (name.length < 2 || name.length > 120) {
    throw new TypeError('Invalid client name');
  }
  return name;
};

const checkDocument = (document: string | null): string | null => {
  if (document !== null && !isValidTaxId(document)) {
    throw new TypeError('Invalid CPF or CNPJ');
  }
  return document;
};

export interface ClientFields {
  readonly name: string;
  /** CPF or CNPJ, digits only. */
  readonly document: string | null;
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
}

export type ClientField = keyof ClientFields;

/** Fields to change; absent or undefined means "keep". */
export type ClientChanges = { readonly [K in ClientField]?: ClientFields[K] | undefined };

export interface ClientSnapshot extends ClientFields {
  readonly id: string;
  readonly organizationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const FIELDS: readonly ClientField[] = [
  'name',
  'document',
  'contactName',
  'contactEmail',
  'contactPhone',
];

/** Who a survey is made for (spec 013). */
export class Client {
  private constructor(private state: ClientSnapshot) {}

  static register(input: ClientFields & { id: string; organizationId: string; now: Date }): Client {
    return new Client({
      id: input.id,
      organizationId: input.organizationId,
      name: normalizeName(input.name),
      document: checkDocument(input.document),
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static fromSnapshot(snapshot: ClientSnapshot): Client {
    return new Client({ ...snapshot });
  }

  toSnapshot(): ClientSnapshot {
    return { ...this.state };
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  /** Applies the changes; returns which fields actually changed. */
  update(changes: ClientChanges, now: Date): ClientField[] {
    const next: ClientFields = {
      name: changes.name === undefined ? this.state.name : normalizeName(changes.name),
      document:
        changes.document === undefined ? this.state.document : checkDocument(changes.document),
      contactName: changes.contactName === undefined ? this.state.contactName : changes.contactName,
      contactEmail:
        changes.contactEmail === undefined ? this.state.contactEmail : changes.contactEmail,
      contactPhone:
        changes.contactPhone === undefined ? this.state.contactPhone : changes.contactPhone,
    };
    const changed = FIELDS.filter((field) => next[field] !== this.state[field]);
    if (changed.length > 0) {
      this.state = { ...this.state, ...next, updatedAt: now };
    }
    return changed;
  }
}
