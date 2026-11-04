import { createParamDecorator, SetMetadata } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Permission } from '@az-pesquisas/contracts';
import type { FastifyRequest } from 'fastify';

import type { Actor } from './actor.js';

export const IS_PUBLIC = 'az:is-public';
export const REQUIRED_PERMISSION = 'az:required-permission';

/** Route reachable without an access token (health, login, password reset). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route-level check from the permission matrix; use cases check again. */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(REQUIRED_PERMISSION, permission);

export type AuthenticatedRequest = FastifyRequest & { actor?: Actor };

/** The authenticated actor; only valid on routes that are not @Public(). */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const actor = ctx.switchToHttp().getRequest<AuthenticatedRequest>().actor;
  if (!actor) {
    throw new Error('CurrentActor used on a route without authentication');
  }
  return actor;
});
