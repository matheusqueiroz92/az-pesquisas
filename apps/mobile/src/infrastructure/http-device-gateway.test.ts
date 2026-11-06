import { err, ok } from '@az-pesquisas/core';
import { describe, expect, it, vi } from 'vitest';

import type { FetchLike } from './http-auth-gateway';
import { createHttpDeviceGateway } from './http-device-gateway';

const PAIRED = {
  deviceId: '0190a5c4-0000-7000-8000-000000000003',
  deviceToken: 'd'.repeat(43),
  organization: { id: '0190a5c4-0000-7000-8000-000000000002', name: 'Instituto AZ' },
};
const INFO = {
  platform: 'android',
  model: 'Samsung A15',
  osVersion: '34',
  appVersion: '0.1.0',
} as const;

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const gatewayWith = (response: Response | Error) => {
  const fetchFn = vi.fn<FetchLike>();
  if (response instanceof Error) {
    fetchFn.mockRejectedValue(response);
  } else {
    fetchFn.mockResolvedValue(response);
  }
  return {
    gateway: createHttpDeviceGateway({ apiUrl: 'http://10.0.2.2:3000/', fetch: fetchFn }),
    fetchFn,
  };
};

describe('HttpDeviceGateway', () => {
  it('pairs with POST /v1/devices/pair and the device description', async () => {
    const { gateway, fetchFn } = gatewayWith(json(201, PAIRED));
    expect(await gateway.pair('123456', INFO)).toEqual(ok(PAIRED));
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('http://10.0.2.2:3000/v1/devices/pair');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ code: '123456', device: INFO });
    expect(new Headers(init?.headers).has('authorization')).toBe(false);
  });

  it('treats an unexpected pairing body as a server error', async () => {
    const { gateway } = gatewayWith(json(201, { deviceId: 'x' }));
    expect(await gateway.pair('123456', INFO)).toEqual(err({ kind: 'server', status: 201 }));
  });

  it('maps 4xx to rejected with the code, 5xx to server, network failure to offline', async () => {
    expect(
      await gatewayWith(json(400, { code: 'PAIRING_CODE_INVALID' })).gateway.pair('1', INFO),
    ).toEqual(err({ kind: 'rejected', status: 400, code: 'PAIRING_CODE_INVALID' }));
    expect(await gatewayWith(json(429)).gateway.pair('1', INFO)).toEqual(
      err({ kind: 'rejected', status: 429, code: undefined }),
    );
    expect(await gatewayWith(json(503)).gateway.pair('1', INFO)).toEqual(
      err({ kind: 'server', status: 503 }),
    );
    expect(
      await gatewayWith(new TypeError('Network request failed')).gateway.pair('1', INFO),
    ).toEqual(err({ kind: 'offline' }));
  });

  it('sends the heartbeat with the device token as Bearer', async () => {
    const { gateway, fetchFn } = gatewayWith(
      json(200, {
        serverTime: '2026-11-06T12:00:00.000Z',
        minimumAppVersion: '0.1.0',
        policy: { deleteSyncedAfterDays: 30 },
      }),
    );
    expect(await gateway.heartbeat('tok', '0.1.0')).toEqual(ok(undefined));
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('http://10.0.2.2:3000/v1/device/heartbeat');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer tok');
    expect(JSON.parse(init?.body as string)).toMatchObject({
      appVersion: '0.1.0',
      pendingInterviews: 0,
    });
  });

  it('reports a revoked device as rejected 401', async () => {
    const { gateway } = gatewayWith(json(401, { code: 'DEVICE_TOKEN_INVALID' }));
    expect(await gateway.heartbeat('tok', '0.1.0')).toEqual(
      err({ kind: 'rejected', status: 401, code: 'DEVICE_TOKEN_INVALID' }),
    );
  });
});
