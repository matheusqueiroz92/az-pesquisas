import { PairDeviceResponse } from '@az-pesquisas/contracts';
import { err, ok } from '@az-pesquisas/core';
import type { Result } from '@az-pesquisas/core';

import type { DeviceGateway } from '../application/device-service';
import type { GatewayError } from '../application/ports';
import type { FetchLike } from './http-auth-gateway';

const TIMEOUT_MS = 15_000;

const codeOf = async (response: Response): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string'
      ? body.code
      : undefined;
  } catch {
    return undefined;
  }
};

/** Pairing and heartbeat (spec 016), with the contracts of spec 006. */
export const createHttpDeviceGateway = (deps: {
  apiUrl: string;
  fetch: FetchLike;
}): DeviceGateway => {
  const base = deps.apiUrl.replace(/\/+$/, '');

  const post = async (
    path: string,
    body: unknown,
    token?: string,
  ): Promise<Result<Response, GatewayError>> => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);
    try {
      const response = await deps.fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (response.ok) {
        return ok(response);
      }
      return err(
        response.status >= 500
          ? { kind: 'server', status: response.status }
          : { kind: 'rejected', status: response.status, code: await codeOf(response) },
      );
    } catch {
      return err({ kind: 'offline' });
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    pair: async (code, device) => {
      const sent = await post('/v1/devices/pair', { code, device });
      if (!sent.ok) {
        return sent;
      }
      try {
        const body = PairDeviceResponse.parse(await sent.value.json());
        return ok({
          deviceId: body.deviceId,
          deviceToken: body.deviceToken,
          organization: { id: body.organization.id, name: body.organization.name },
        });
      } catch {
        return err({ kind: 'server', status: sent.value.status });
      }
    },
    heartbeat: async (deviceToken, appVersion) => {
      const sent = await post(
        '/v1/device/heartbeat',
        {
          appVersion,
          batteryLevel: null,
          pendingInterviews: 0,
          pendingMediaBytes: 0,
          storageFreeBytes: null,
          lastSyncError: null,
        },
        deviceToken,
      );
      return sent.ok ? ok(undefined) : sent;
    },
  };
};
