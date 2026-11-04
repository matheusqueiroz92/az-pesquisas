import { BadRequestException } from '@nestjs/common';
import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

export interface FieldError {
  /** Dotted path to the field ("profile.age"); empty for the body itself. */
  readonly field: string;
  /** Zod issue code ("too_small", "invalid_format"...): the client translates it. */
  readonly code: string;
}

/**
 * Validates and normalizes a request part with a schema from packages/contracts
 * (ADR-0012, replacing nestjs-zod). On failure: 400 VALIDATION_FAILED listing
 * field names and issue codes only, never the submitted values (they may be passwords).
 */
export class ZodValidationPipe<S extends z.ZodType> implements PipeTransform<unknown, z.output<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.output<S> {
    const result = this.schema.safeParse(value);
    if (result.success) {
      return result.data;
    }

    const errors: FieldError[] = result.error.issues.flatMap((issue): FieldError[] =>
      issue.code === 'unrecognized_keys'
        ? issue.keys.map((key) => ({
            field: [...issue.path, key].join('.'),
            code: issue.code,
          }))
        : [{ field: issue.path.join('.'), code: issue.code }],
    );

    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      detail: 'The request is invalid',
      errors,
    });
  }
}
