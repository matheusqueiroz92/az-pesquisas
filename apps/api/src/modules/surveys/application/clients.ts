import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import { Client } from '../domain/client.js';
import type { ClientChanges, ClientFields } from '../domain/client.js';
import { asManager } from './authorization.js';
import type { Actor } from './ports.js';
import type { SurveysDeps } from './surveys-deps.js';
import { toClientDetails } from './views.js';
import type { ClientDetails } from './views.js';

const surveyCountOf = async (deps: SurveysDeps, clientId: string): Promise<number> =>
  (await deps.surveys.countByClient()).get(clientId) ?? 0;

export const listClients = (
  deps: SurveysDeps,
  actor: Actor,
): Promise<Result<ClientDetails[], 'FORBIDDEN'>> =>
  asManager(deps, actor, async () => {
    const [clients, counts] = await Promise.all([
      deps.clients.list(),
      deps.surveys.countByClient(),
    ]);
    return ok(clients.map((client) => toClientDetails(client, counts.get(client.id) ?? 0)));
  });

export const getClient = (
  deps: SurveysDeps,
  actor: Actor,
  clientId: string,
): Promise<Result<ClientDetails, 'FORBIDDEN' | 'CLIENT_NOT_FOUND'>> =>
  asManager(deps, actor, async () => {
    const client = await deps.clients.findById(clientId);
    if (!client) {
      return err('CLIENT_NOT_FOUND');
    }
    return ok(toClientDetails(client, await surveyCountOf(deps, client.id)));
  });

export const createClient = (
  deps: SurveysDeps,
  actor: Actor,
  input: ClientFields,
): Promise<Result<ClientDetails, 'FORBIDDEN'>> =>
  asManager(deps, actor, async () => {
    const client = Client.register({
      ...input,
      id: deps.ids.next(),
      organizationId: actor.organizationId,
      now: deps.clock.now(),
    });
    await deps.clients.add(client);
    await deps.audit.record({
      action: 'client.created',
      actorUserId: actor.userId,
      entity: 'client',
      entityId: client.id,
    });
    return ok(toClientDetails(client, 0));
  });

export const updateClient = (
  deps: SurveysDeps,
  actor: Actor,
  clientId: string,
  changes: ClientChanges,
): Promise<Result<ClientDetails, 'FORBIDDEN' | 'CLIENT_NOT_FOUND'>> =>
  asManager(deps, actor, async () => {
    const client = await deps.clients.findById(clientId, { forUpdate: true });
    if (!client) {
      return err('CLIENT_NOT_FOUND');
    }
    const changed = client.update(changes, deps.clock.now());
    if (changed.length > 0) {
      await deps.clients.save(client);
      await deps.audit.record({
        action: 'client.updated',
        actorUserId: actor.userId,
        entity: 'client',
        entityId: client.id,
        metadata: { changed },
      });
    }
    return ok(toClientDetails(client, await surveyCountOf(deps, client.id)));
  });

/** A client with surveys (even archived ones) stays (spec 013 rule 4). */
export const deleteClient = (
  deps: SurveysDeps,
  actor: Actor,
  clientId: string,
): Promise<Result<void, 'FORBIDDEN' | 'CLIENT_NOT_FOUND' | 'CLIENT_IN_USE'>> =>
  asManager(deps, actor, async () => {
    // The lock makes a survey created at the same time wait for this decision.
    const client = await deps.clients.findById(clientId, { forUpdate: true });
    if (!client) {
      return err('CLIENT_NOT_FOUND');
    }
    if ((await surveyCountOf(deps, client.id)) > 0) {
      return err('CLIENT_IN_USE');
    }
    await deps.clients.remove(client.id);
    await deps.audit.record({
      action: 'client.deleted',
      actorUserId: actor.userId,
      entity: 'client',
      entityId: client.id,
    });
    return ok(undefined);
  });
