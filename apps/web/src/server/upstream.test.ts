import { afterEach, describe, expect, it, vi } from 'vitest';

import { callApi, forwardedHeaders } from './upstream';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('forwardedHeaders', () => {
  it('passes client IP, user agent and request id, and nothing else', () => {
    const incoming = new Headers({
      'x-forwarded-for': '203.0.113.7',
      'user-agent': 'Firefox',
      'x-request-id': 'req-1',
      cookie: 'az_at=secret; az_rt=secret',
      authorization: 'Bearer forged',
    });
    expect(Object.fromEntries(forwardedHeaders(incoming))).toEqual({
      'x-forwarded-for': '203.0.113.7',
      'user-agent': 'Firefox',
      'x-request-id': 'req-1',
    });
  });

  it('falls back to X-Real-IP and omits what is missing', () => {
    expect(
      Object.fromEntries(forwardedHeaders(new Headers({ 'x-real-ip': '203.0.113.8' }))),
    ).toEqual({
      'x-forwarded-for': '203.0.113.8',
    });
    expect([...forwardedHeaders(new Headers())]).toEqual([]);
  });
});

describe('callApi', () => {
  it('calls API_URL with the bearer token, body and query string', async () => {
    vi.stubEnv('API_URL', 'http://api:3000');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    await callApi('/v1/users', {
      method: 'POST',
      incoming: new Headers({ cookie: 'az_rt=never-forwarded' }),
      accessToken: 'at-1',
      body: '{"a":1}',
      search: '?page=2',
    });
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(url).toEqual(new URL('http://api:3000/v1/users?page=2'));
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer at-1');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('cookie')).toBeNull();
    expect(init?.body).toBe('{"a":1}');
    expect(init?.redirect).toBe('manual');
  });

  it('sends no authorization or content type when there is no token or body', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    await callApi('/v1/auth/me', { method: 'GET', incoming: new Headers() });
    const headers = new Headers(fetchSpy.mock.calls[0]?.[1]?.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('content-type')).toBeNull();
  });
});
