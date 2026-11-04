import { describe, expect, it } from 'vitest';

import { andThen, err, isErr, isOk, map, mapErr, match, ok, unwrapOr } from './result.js';
import type { Result } from './result.js';

type DivisionError = 'DIVISION_BY_ZERO';

const divide = (a: number, b: number): Result<number, DivisionError> =>
  b === 0 ? err('DIVISION_BY_ZERO') : ok(a / b);

describe('Result', () => {
  it('creates a success carrying a value', () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it('creates a failure carrying an error', () => {
    const result = err('SURVEY_HAS_INTERVIEWS');

    expect(result).toEqual({ ok: false, error: 'SURVEY_HAS_INTERVIEWS' });
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it('narrows the type through the ok discriminant', () => {
    const result = divide(10, 2);

    if (result.ok) {
      expect(result.value).toBe(5);
    } else {
      expect.unreachable('division by 2 must succeed');
    }
  });

  describe('map', () => {
    it('transforms the value of a success', () => {
      expect(map(divide(10, 2), (n) => n * 3)).toEqual(ok(15));
    });

    it('passes a failure through untouched', () => {
      expect(map(divide(10, 0), (n) => n * 3)).toEqual(err('DIVISION_BY_ZERO'));
    });
  });

  describe('mapErr', () => {
    it('transforms the error of a failure', () => {
      expect(mapErr(divide(1, 0), (e) => `code:${e}`)).toEqual(err('code:DIVISION_BY_ZERO'));
    });

    it('passes a success through untouched', () => {
      expect(mapErr(divide(4, 2), (e) => `code:${e}`)).toEqual(ok(2));
    });
  });

  describe('andThen', () => {
    it('chains operations that can fail', () => {
      expect(andThen(divide(100, 2), (n) => divide(n, 5))).toEqual(ok(10));
    });

    it('stops at the first failure', () => {
      let calls = 0;
      const result = andThen(divide(1, 0), (n) => {
        calls += 1;
        return divide(n, 5);
      });

      expect(result).toEqual(err('DIVISION_BY_ZERO'));
      expect(calls).toBe(0);
    });

    it('returns the failure of the chained operation', () => {
      expect(andThen(divide(10, 2), (n) => divide(n, 0))).toEqual(err('DIVISION_BY_ZERO'));
    });
  });

  describe('unwrapOr', () => {
    it('returns the value of a success', () => {
      expect(unwrapOr(divide(9, 3), -1)).toBe(3);
    });

    it('returns the fallback for a failure', () => {
      expect(unwrapOr(divide(9, 0), -1)).toBe(-1);
    });
  });

  describe('match', () => {
    it('runs the ok branch for a success', () => {
      const text = match(divide(8, 4), {
        ok: (n) => `resultado ${n}`,
        err: (e) => `erro ${e}`,
      });

      expect(text).toBe('resultado 2');
    });

    it('runs the err branch for a failure', () => {
      const text = match(divide(8, 0), {
        ok: (n) => `resultado ${n}`,
        err: (e) => `erro ${e}`,
      });

      expect(text).toBe('erro DIVISION_BY_ZERO');
    });
  });
});
