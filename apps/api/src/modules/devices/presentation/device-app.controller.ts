import { Body, Controller, Headers, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HeartbeatRequest, PairDeviceRequest } from '@az-pesquisas/contracts';
import type { HeartbeatResponse, PairDeviceResponse } from '@az-pesquisas/contracts';

import { Public } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import type { DevicesDeps } from '../application/devices-deps.js';
import { heartbeat, pairDevice } from '../application/devices.js';
import { DEVICES_DEPS } from './devices.tokens.js';
import { httpError } from './http-errors.js';

const MINUTE = 60_000;

/** The device token, from `Authorization: Bearer` (spec 006). */
const bearer = (authorization: string | undefined): string | undefined => {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '');
  return match?.[1];
};

/** Routes the field app calls with no user session (spec 016). */
@Controller('v1')
export class DeviceAppController {
  constructor(@Inject(DEVICES_DEPS) private readonly deps: DevicesDeps) {}

  /** Redeems a pairing code. Tight limit: 6 digits must not be guessable (rule 4). */
  @Post('devices/pair')
  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  async pair(
    @Body(new ZodValidationPipe(PairDeviceRequest)) body: PairDeviceRequest,
  ): Promise<PairDeviceResponse> {
    const result = await pairDevice(this.deps, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return result.value;
  }

  @Post('device/heartbeat')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: MINUTE } })
  async heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body(new ZodValidationPipe(HeartbeatRequest)) body: HeartbeatRequest,
  ): Promise<HeartbeatResponse> {
    const token = bearer(authorization);
    if (!token) {
      throw httpError('DEVICE_TOKEN_INVALID');
    }
    const result = await heartbeat(this.deps, token, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return { ...result.value, serverTime: result.value.serverTime.toISOString() };
  }
}
