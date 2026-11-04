import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { ZodValidationPipe } from './zod-validation.pipe.js';

const Schema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(10),
  profile: z.object({ age: z.number().int() }).optional(),
});

const pipe = new ZodValidationPipe(Schema);

const failure = (input: unknown): Record<string, unknown> => {
  try {
    pipe.transform(input);
  } catch (error) {
    if (error instanceof BadRequestException) {
      return error.getResponse() as Record<string, unknown>;
    }
    throw error;
  }
  throw new Error('expected validation to fail');
};

describe('ZodValidationPipe (ADR-0012)', () => {
  it('returns the parsed (normalized) value', () => {
    expect(pipe.transform({ email: ' A@B.COM ', password: '0123456789' })).toEqual({
      email: 'a@b.com',
      password: '0123456789',
    });
  });

  it('CA-09: fails with VALIDATION_FAILED and one entry per invalid field', () => {
    const body = failure({ email: 'nope', password: 'short', profile: { age: 1.5 } });

    expect(body['code']).toBe('VALIDATION_FAILED');
    expect(body['detail']).toBe('The request is invalid');
    expect(body['errors']).toEqual([
      { field: 'email', code: 'invalid_format' },
      { field: 'password', code: 'too_small' },
      { field: 'profile.age', code: 'invalid_type' },
    ]);
  });

  it('CA-09: never echoes submitted values back', () => {
    const body = failure({ email: 'segredo@@x', password: 'senhaX' });

    expect(JSON.stringify(body)).not.toContain('segredo');
    expect(JSON.stringify(body)).not.toContain('senhaX');
  });

  it('reports unknown fields by name (strict objects)', () => {
    const body = failure({ email: 'a@b.com', password: '0123456789', organizationId: 'x' });

    expect(body['errors']).toEqual([{ field: 'organizationId', code: 'unrecognized_keys' }]);
  });

  it('reports a body that is not an object at the root', () => {
    expect(failure('texto')['errors']).toEqual([{ field: '', code: 'invalid_type' }]);
  });
});
