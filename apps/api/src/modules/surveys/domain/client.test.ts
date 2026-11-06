import { describe, expect, it } from 'vitest';

import { Client } from './client.js';

const T0 = new Date('2026-11-05T12:00:00Z');
const T1 = new Date('2026-11-05T13:00:00Z');
const ORG = '0193a000-0000-7000-8000-0000000000a0';
const ID = '0193a000-0000-7000-8000-0000000000c1';

const register = (overrides: Partial<Parameters<typeof Client.register>[0]> = {}) =>
  Client.register({
    id: ID,
    organizationId: ORG,
    name: ' Prefeitura de Itapetinga ',
    document: '11222333000181',
    contactName: 'Ana',
    contactEmail: 'ana@itapetinga.ba.gov.br',
    contactPhone: '(77) 3261-0000',
    now: T0,
    ...overrides,
  });

describe('Client.register', () => {
  it('trims the name and keeps the fields', () => {
    expect(register().toSnapshot()).toEqual({
      id: ID,
      organizationId: ORG,
      name: 'Prefeitura de Itapetinga',
      document: '11222333000181',
      contactName: 'Ana',
      contactEmail: 'ana@itapetinga.ba.gov.br',
      contactPhone: '(77) 3261-0000',
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it.each([
    ['a one-letter name', { name: ' A ' }],
    ['an invalid document', { document: '11222333000182' }],
  ])('refuses %s', (_case, overrides) => {
    expect(() => register(overrides)).toThrow(TypeError);
  });

  it('round-trips through a snapshot', () => {
    const client = register();
    expect(Client.fromSnapshot(client.toSnapshot()).toSnapshot()).toEqual(client.toSnapshot());
    expect(client.id).toBe(ID);
    expect(client.name).toBe('Prefeitura de Itapetinga');
  });
});

describe('Client.update', () => {
  it('reports only the fields that changed and touches updatedAt', () => {
    const client = register();
    expect(client.update({ name: 'Prefeitura de Itapetinga', contactName: 'Bruno' }, T1)).toEqual([
      'contactName',
    ]);
    expect(client.toSnapshot()).toMatchObject({ contactName: 'Bruno', updatedAt: T1 });
  });

  it('can clear optional fields', () => {
    const client = register();
    expect(
      client.update(
        { document: null, contactName: null, contactEmail: null, contactPhone: null },
        T1,
      ),
    ).toEqual(['document', 'contactName', 'contactEmail', 'contactPhone']);
  });

  it('changes the name, normalized', () => {
    const client = register();
    expect(client.update({ name: '  Câmara de Itambé ' }, T1)).toEqual(['name']);
    expect(client.name).toBe('Câmara de Itambé');
  });

  it('keeps updatedAt when nothing changed', () => {
    const client = register();
    expect(client.update({ contactName: 'Ana' }, T1)).toEqual([]);
    expect(client.toSnapshot().updatedAt).toBe(T0);
  });

  it('refuses an invalid document', () => {
    expect(() => register().update({ document: '123' }, T1)).toThrow(TypeError);
  });
});
