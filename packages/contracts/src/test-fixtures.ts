// Test helper (excluded from the build): loads the frozen v1 examples from disk.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FIXTURE_NAMES = [
  'questionnaire-snapshot',
  'interview-completed',
  'interview-refused',
  'pair-device-request',
  'pair-device-response',
  'sync-interviews-request',
  'sync-interviews-response',
  'sync-pull-request',
  'sync-pull-response',
  'heartbeat-request',
  'heartbeat-response',
  'azp-manifest',
] as const;

export type FixtureName = (typeof FIXTURE_NAMES)[number];

/** A fresh deep copy each call, so tests can mutate it freely. */
export const fixture = (name: FixtureName): Record<string, unknown> =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`../fixtures/v1/${name}.json`, import.meta.url)), 'utf8'),
  ) as Record<string, unknown>;
