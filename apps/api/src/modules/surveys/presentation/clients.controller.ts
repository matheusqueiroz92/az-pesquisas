import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateClientRequest, Id, UpdateClientRequest } from '@az-pesquisas/contracts';
import type { ClientListResponse, ClientView } from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, RequirePermission } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import {
  createClient,
  deleteClient,
  getClient,
  listClients,
  updateClient,
} from '../application/clients.js';
import type { SurveysDeps } from '../application/surveys-deps.js';
import { httpError } from './http-errors.js';
import { SURVEYS_DEPS } from './surveys.tokens.js';
import { toClientView } from './views.js';

@Controller('v1/clients')
@RequirePermission('surveys.manage')
export class ClientsController {
  constructor(@Inject(SURVEYS_DEPS) private readonly deps: SurveysDeps) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<ClientListResponse> {
    const result = await listClients(this.deps, actor);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return { items: result.value.map(toClientView) };
  }

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateClientRequest)) body: CreateClientRequest,
  ): Promise<ClientView> {
    const result = await createClient(this.deps, actor, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toClientView(result.value);
  }

  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
  ): Promise<ClientView> {
    const result = await getClient(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toClientView(result.value);
  }

  @Patch(':id')
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
    @Body(new ZodValidationPipe(UpdateClientRequest)) body: UpdateClientRequest,
  ): Promise<ClientView> {
    const result = await updateClient(this.deps, actor, id, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toClientView(result.value);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
  ): Promise<void> {
    const result = await deleteClient(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
  }
}
