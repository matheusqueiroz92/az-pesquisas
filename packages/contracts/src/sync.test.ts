import { describe, expect, it } from 'vitest';

import { AzpManifest } from './azp.js';
import {
  HeartbeatRequest,
  PairDeviceRequest,
  SYNC_REJECTION_CODES,
  SyncInterviewsRequest,
  SyncInterviewsResponse,
  SyncPullResponse,
} from './sync.js';
import { fixture } from './test-fixtures.js';

type Json = Record<string, unknown>;

describe('SyncInterviewsRequest (CA-05)', () => {
  const batch = () => fixture('sync-interviews-request');
  const interviews = (b: Json) => b['interviews'] as Json[];

  it('accepts the example batch', () => {
    expect(SyncInterviewsRequest.safeParse(batch()).success).toBe(true);
  });

  it('rejects an empty batch and a batch above 20 interviews', () => {
    const empty = batch();
    empty['interviews'] = [];
    const big = batch();
    big['interviews'] = Array.from({ length: 21 }, (_, n) => ({
      ...interviews(big)[1]!,
      id: `0194b2c3-1a00-7000-8000-${String(100 + n).padStart(12, '0')}`,
    }));

    expect(SyncInterviewsRequest.safeParse(empty).success).toBe(false);
    expect(SyncInterviewsRequest.safeParse(big).success).toBe(false);
  });

  it('rejects the same interview id twice in a batch', () => {
    const b = batch();
    interviews(b)[1] = { ...interviews(b)[1]!, id: interviews(b)[0]!['id'] };

    const result = SyncInterviewsRequest.safeParse(b);

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toContain('interviews.1.id');
  });

  it('requires sentAt (the API derives the device clock offset from it)', () => {
    const b = batch();
    delete b['sentAt'];

    expect(SyncInterviewsRequest.safeParse(b).success).toBe(false);
  });
});

describe('other sync messages', () => {
  it('accepts every example message', () => {
    expect(PairDeviceRequest.safeParse(fixture('pair-device-request')).success).toBe(true);
    expect(SyncInterviewsResponse.safeParse(fixture('sync-interviews-response')).success).toBe(
      true,
    );
    expect(SyncPullResponse.safeParse(fixture('sync-pull-response')).success).toBe(true);
    expect(HeartbeatRequest.safeParse(fixture('heartbeat-request')).success).toBe(true);
    expect(AzpManifest.safeParse(fixture('azp-manifest')).success).toBe(true);
  });

  it.each([['12345'], ['1234567'], ['12a456']])('rejects the pairing code %j', (code) => {
    expect(PairDeviceRequest.safeParse({ ...fixture('pair-device-request'), code }).success).toBe(
      false,
    );
  });

  it('only allows the documented rejection codes', () => {
    expect(SYNC_REJECTION_CODES).toEqual([
      'VERSION_UNKNOWN',
      'SURVEY_NOT_ASSIGNED',
      'INTERVIEWER_NOT_AUTHORIZED',
      'VALIDATION_FAILED',
    ]);
    const response = fixture('sync-interviews-response');
    response['rejected'] = [{ id: '0194b2c3-1a00-7000-8000-000000000002', code: 'NOPE' }];

    expect(SyncInterviewsResponse.safeParse(response).success).toBe(false);
  });

  it('heartbeat keeps battery between 0 and 1 and never accepts negative counters', () => {
    const base = fixture('heartbeat-request');

    expect(HeartbeatRequest.safeParse({ ...base, batteryLevel: 1.2 }).success).toBe(false);
    expect(HeartbeatRequest.safeParse({ ...base, pendingInterviews: -1 }).success).toBe(false);
    expect(HeartbeatRequest.safeParse({ ...base, batteryLevel: null }).success).toBe(true);
  });

  it('the .azp manifest rejects paths that escape the package', () => {
    const manifest = fixture('azp-manifest');
    (manifest['files'] as Json[]).push({
      path: '../etc/passwd',
      sizeBytes: 1,
      sha256: 'd'.repeat(64),
    });

    expect(AzpManifest.safeParse(manifest).success).toBe(false);
  });

  it('the pull response carries interviewer PINs only as scrypt hashes', () => {
    const response = fixture('sync-pull-response');
    const items = (response['interviewers'] as Json)['items'] as Json[];
    items[0]!['pin'] = '123456';

    expect(SyncPullResponse.safeParse(response).success).toBe(false);
  });
});
