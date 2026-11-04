import { afterEach, describe, expect, it, vi } from 'vitest';

import { send } from './http';

const respond = (status: number, body?: unknown, contentType = 'application/json') =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': contentType },
    }),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('send', () => {
  it('posts JSON to the panel and returns the parsed body', async () => {
    const fetchSpy = respond(200, { user: { name: 'Ana' } });
    await expect(send('POST', '/api/auth/login', { email: 'a@b.co' })).resolves.toEqual({
      ok: true,
      data: { user: { name: 'Ana' } },
    });
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toBe('/api/auth/login');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"email":"a@b.co"}');
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
  });

  it('returns undefined data for 204', async () => {
    respond(204);
    await expect(send('POST', '/api/auth/logout')).resolves.toEqual({ ok: true, data: undefined });
  });

  it('returns the Problem Details code and field errors', async () => {
    respond(
      400,
      { code: 'VALIDATION_FAILED', errors: [{ field: 'email', code: 'invalid_format' }] },
      'application/problem+json',
    );
    await expect(send('POST', '/api/v1/users', {})).resolves.toEqual({
      ok: false,
      status: 400,
      code: 'VALIDATION_FAILED',
      fields: ['email'],
    });
  });

  it('copes with an error body that is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(send('GET', '/api/v1/users')).resolves.toEqual({
      ok: false,
      status: 502,
      code: undefined,
      fields: [],
    });
  });

  it('reports a network failure as status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(send('GET', '/api/v1/users')).resolves.toEqual({
      ok: false,
      status: 0,
      code: undefined,
      fields: [],
    });
  });
});
