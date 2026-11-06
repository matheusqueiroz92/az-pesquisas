import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Id, UpdateDeviceRequest } from '@az-pesquisas/contracts';
import type {
  DeviceListResponse,
  DeviceView,
  PairingCreated,
  PairingStatus,
} from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, RequirePermission } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import type { DevicesDeps } from '../application/devices-deps.js';
import {
  createPairing,
  getPairing,
  listDevices,
  renameDevice,
  revokeDevice,
} from '../application/devices.js';
import { DEVICES_DEPS } from './devices.tokens.js';
import { httpError } from './http-errors.js';
import { toDeviceView } from './views.js';

const IdParam = new ZodValidationPipe(Id);

/** Devices of the organization, managed from the panel (spec 016). */
@Controller('v1/devices')
@RequirePermission('devices.manage')
export class DevicesController {
  constructor(@Inject(DEVICES_DEPS) private readonly deps: DevicesDeps) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<DeviceListResponse> {
    const result = await listDevices(this.deps, actor);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return { items: result.value.map(toDeviceView) };
  }

  @Post('pairings')
  async createPairing(@CurrentActor() actor: Actor): Promise<PairingCreated> {
    const result = await createPairing(this.deps, actor);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return { ...result.value, expiresAt: result.value.expiresAt.toISOString() };
  }

  @Get('pairings/:id')
  async getPairing(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
  ): Promise<PairingStatus> {
    const result = await getPairing(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    const { device, expiresAt, ...rest } = result.value;
    return {
      ...rest,
      expiresAt: expiresAt.toISOString(),
      device: device ? toDeviceView(device) : null,
    };
  }

  @Patch(':id')
  async rename(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
    @Body(new ZodValidationPipe(UpdateDeviceRequest)) body: UpdateDeviceRequest,
  ): Promise<DeviceView> {
    const result = await renameDevice(this.deps, actor, id, body.nickname);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toDeviceView(result.value);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  async revoke(
    @CurrentActor() actor: Actor,
    @Param('id', IdParam) id: string,
  ): Promise<DeviceView> {
    const result = await revokeDevice(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toDeviceView(result.value);
  }
}
