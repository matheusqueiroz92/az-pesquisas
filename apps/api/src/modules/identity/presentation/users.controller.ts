import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { CreateUserRequest, Id, UpdateUserRequest } from '@az-pesquisas/contracts';
import type { UserListResponse, UserView } from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, RequirePermission } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import type { IdentityDeps } from '../application/identity-deps.js';
import { createUser, getUser, listUsers, updateUser } from '../application/user-management.js';
import type { UserDetails } from '../application/views.js';
import { httpError } from './http-errors.js';
import { IDENTITY_DEPS } from './identity.tokens.js';

const toView = (user: UserDetails): UserView => ({
  ...user,
  lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
});

@Controller('v1/users')
@RequirePermission('users.manage')
export class UsersController {
  constructor(@Inject(IDENTITY_DEPS) private readonly deps: IdentityDeps) {}

  @Get()
  async list(@CurrentActor() actor: Actor): Promise<UserListResponse> {
    const result = await listUsers(this.deps, actor);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return { items: result.value.map(toView) };
  }

  @Post()
  async create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(CreateUserRequest)) body: CreateUserRequest,
  ): Promise<UserView> {
    const result = await createUser(this.deps, actor, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toView(result.value);
  }

  @Get(':id')
  async get(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
  ): Promise<UserView> {
    const result = await getUser(this.deps, actor, id);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toView(result.value);
  }

  @Patch(':id')
  async update(
    @CurrentActor() actor: Actor,
    @Param('id', new ZodValidationPipe(Id)) id: string,
    @Body(new ZodValidationPipe(UpdateUserRequest)) body: UpdateUserRequest,
  ): Promise<UserView> {
    const result = await updateUser(this.deps, actor, id, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toView(result.value);
  }
}
