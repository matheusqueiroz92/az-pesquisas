import { describe, expect, it } from 'vitest';

import { Interview } from './interview.js';
import { fixture } from './test-fixtures.js';

type Json = Record<string, unknown>;

const completed = () => fixture('interview-completed');
const answers = (i: Json) => i['answers'] as Json[];

const rejectionPaths = (i: Json): string[] => {
  const result = Interview.safeParse(i);
  expect(result.success, 'expected the interview to be rejected').toBe(false);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
};

describe('Interview (CA-04)', () => {
  it('accepts a completed interview with every answer kind', () => {
    const parsed = Interview.parse(completed());

    expect(parsed.answers.map((a) => a.kind)).toEqual([
      'choice',
      'number',
      'text',
      'number',
      'choice',
      'matrix',
      'choice',
      'ranking',
      'date',
      'media',
      'media',
    ]);
  });

  it('accepts a refusal: consent declined and no answers', () => {
    expect(Interview.safeParse(fixture('interview-refused')).success).toBe(true);
  });

  it('rejects finishedAt before startedAt', () => {
    const i = completed();
    i['finishedAt'] = '2026-11-10T13:00:00.000Z';

    expect(rejectionPaths(i)).toContain('finishedAt');
  });

  it('rejects two answers to the same question', () => {
    const i = completed();
    answers(i).push({ ...answers(i)[0] });

    expect(rejectionPaths(i)).toContain('answers.11.questionId');
  });

  it('rejects answers when consent was declined', () => {
    const i = completed();
    i['consent'] = { accepted: false, textHash: 'f'.repeat(64) };

    expect(rejectionPaths(i)).toContain('answers');
  });

  it.each([['organizationId'], ['deviceId']])(
    'rejects %s in the body: the API takes it from the device token (AGENTS.md rule 5)',
    (field) => {
      const i = completed();
      i[field] = '0193a000-0000-7000-8000-000000000099';

      expect(rejectionPaths(i)).toContain('');
    },
  );

  it.each([
    ['latitude', { lat: 91, lng: 0 }],
    ['longitude', { lat: 0, lng: -181 }],
  ])('rejects an impossible %s', (_case, coords) => {
    const i = completed();
    const location = i['location'] as Json;
    location['start'] = { ...(location['start'] as Json), ...coords };

    expect(rejectionPaths(i).some((p) => p.startsWith('location.start'))).toBe(true);
  });

  it('rejects a choice with no option, a non-finite number and a malformed date', () => {
    const i = completed();
    answers(i)[0]!['optionIds'] = [];
    answers(i)[1]!['value'] = '34';
    answers(i)[8]!['value'] = '15/03/1992';

    const paths = rejectionPaths(i);

    expect(paths).toContain('answers.0.optionIds');
    expect(paths).toContain('answers.1.value');
    expect(paths).toContain('answers.8.value');
  });

  it('rejects an answer kind that does not exist', () => {
    const i = completed();
    answers(i)[2]!['kind'] = 'voice';

    expect(rejectionPaths(i).some((p) => p.startsWith('answers.2'))).toBe(true);
  });

  it('rejects a media answer pointing to a media id not listed in media', () => {
    const i = completed();
    answers(i)[9]!['mediaIds'] = ['0193a000-0000-7000-8000-000000009999'];

    expect(rejectionPaths(i)).toContain('answers.9.mediaIds');
  });

  it('rejects a malformed media hash and an oversized media file', () => {
    const i = completed();
    const media = i['media'] as Json[];
    media[0]!['sha256'] = 'not-a-hash';
    media[1]!['sizeBytes'] = 300 * 1024 * 1024;

    const paths = rejectionPaths(i);

    expect(paths).toContain('media.0.sha256');
    expect(paths).toContain('media.1.sizeBytes');
  });

  it('accepts location null (GPS off in the survey) and consent null (no consent text)', () => {
    const i = completed();
    i['location'] = null;
    i['consent'] = null;

    expect(Interview.safeParse(i).success).toBe(true);
  });
});
