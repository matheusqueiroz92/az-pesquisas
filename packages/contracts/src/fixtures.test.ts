import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import * as contracts from './index.js';
import { fixture } from './test-fixtures.js';
import type { FixtureName } from './test-fixtures.js';

// CA-01: the frozen v1 examples. If one of these stops parsing, the change is
// incompatible with apps already installed: bump schemaVersion (spec 006, rule 3).
const CONTRACT_OF: Readonly<Record<FixtureName, z.ZodType>> = {
  'questionnaire-snapshot': contracts.QuestionnaireSnapshot,
  'interview-completed': contracts.Interview,
  'interview-refused': contracts.Interview,
  'pair-device-request': contracts.PairDeviceRequest,
  'pair-device-response': contracts.PairDeviceResponse,
  'sync-interviews-request': contracts.SyncInterviewsRequest,
  'sync-interviews-response': contracts.SyncInterviewsResponse,
  'sync-pull-request': contracts.SyncPullRequest,
  'sync-pull-response': contracts.SyncPullResponse,
  'heartbeat-request': contracts.HeartbeatRequest,
  'heartbeat-response': contracts.HeartbeatResponse,
  'azp-manifest': contracts.AzpManifest,
};

describe('frozen v1 examples (CA-01)', () => {
  it.each(Object.entries(CONTRACT_OF))('%s is accepted by its contract', (name, schema) => {
    const result = schema.safeParse(fixture(name as FixtureName));

    expect(result.error?.issues ?? []).toEqual([]);
  });
});

describe('JSON Schema export (CA-06, base for OpenAPI per ADR-0012)', () => {
  const exported = {
    ...CONTRACT_OF,
    LoginRequest: contracts.LoginRequest,
    TokenResponse: contracts.TokenResponse,
    CreateUserRequest: contracts.CreateUserRequest,
    UpdateUserRequest: contracts.UpdateUserRequest,
  };

  it.each(Object.entries(exported))('%s converts to JSON Schema', (_name, schema) => {
    const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });

    expect(json).toHaveProperty('$schema');
  });
});
