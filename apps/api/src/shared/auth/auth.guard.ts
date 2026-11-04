import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can } from '@az-pesquisas/contracts';
import type { Permission } from '@az-pesquisas/contracts';

import { ACCESS_TOKEN_VERIFIER } from './actor.js';
import type { AccessTokenVerifier } from './actor.js';
import { IS_PUBLIC, REQUIRED_PERMISSION } from './decorators.js';
import type { AuthenticatedRequest } from './decorators.js';

const unauthenticated = () =>
  new UnauthorizedException({
    code: 'UNAUTHENTICATED',
    detail: 'A valid access token is required',
  });

/**
 * Global guard: every route requires a valid access token unless marked
 * @Public(). The token is the ONLY source of the organization (AGENTS.md rule 5).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    const actor = token ? await this.verifier.verify(token) : undefined;
    if (!actor) {
      throw unauthenticated();
    }
    request.actor = actor;

    const required = this.reflector.getAllAndOverride<Permission | undefined>(
      REQUIRED_PERMISSION,
      targets,
    );
    if (required && !can(actor.role, required)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        detail: 'You do not have permission for this action',
      });
    }
    return true;
  }
}
