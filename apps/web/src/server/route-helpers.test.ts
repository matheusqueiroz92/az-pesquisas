import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import {
  clearSessionCookies,
  problem,
  readBody,
  rejectCrossOrigin,
  relay,
  TOO_LARGE,
  withCookies,
} from './route-helpers';

const request = (method: string, headers: Record<string, string>, body?: string) =>
  new NextRequest('http://localhost:3001/api/v1/users', { method, headers, body });

describe('route helpers', () => {
  it('problem() answers in the API Problem Details format', async () => {
    const response = problem(403, 'FORBIDDEN');
    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('rejectCrossOrigin() blocks a POST from another site and lets the panel through', () => {
    expect(
      rejectCrossOrigin(request('POST', { host: 'localhost:3001', origin: 'https://evil.example' }))
        ?.status,
    ).toBe(403);
    expect(
      rejectCrossOrigin(
        request('POST', { host: 'localhost:3001', origin: 'http://localhost:3001' }),
      ),
    ).toBeUndefined();
    expect(rejectCrossOrigin(request('GET', {}))).toBeUndefined();
  });

  it('readBody() returns the text, undefined when empty, and refuses more than 64 KiB', async () => {
    expect(await readBody(request('POST', {}, '{"a":1}'))).toBe('{"a":1}');
    expect(await readBody(request('POST', {}))).toBeUndefined();
    expect(await readBody(request('POST', {}, 'x'.repeat(64 * 1024 + 1)))).toBe(TOO_LARGE);
  });

  it('relay() copies status and body but none of the API headers', async () => {
    const upstream = new Response('{"code":"CONFLICT"}', {
      status: 409,
      headers: {
        'content-type': 'application/problem+json',
        'set-cookie': 'x=1',
        server: 'fastify',
      },
    });
    const response = await relay(upstream);
    expect(response.status).toBe(409);
    expect(await response.text()).toBe('{"code":"CONFLICT"}');
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('server')).toBeNull();
  });

  it('relay() keeps 204 without a body and defaults the content type', async () => {
    expect((await relay(new Response(null, { status: 204 }))).status).toBe(204);
    const noType = new Response('[]', { status: 200 });
    noType.headers.delete('content-type');
    expect((await relay(noType)).headers.get('content-type')).toBe('application/json');
  });

  it('clearSessionCookies() expires both cookies', () => {
    const response = withCookies(problem(401, 'UNAUTHENTICATED'), clearSessionCookies());
    const header = response.headers.getSetCookie().join('\n');
    expect(header).toMatch(/az_at=;.*Max-Age=0/);
    expect(header).toMatch(/az_rt=;.*Max-Age=0/);
    expect(header).toContain('HttpOnly');
  });
});
