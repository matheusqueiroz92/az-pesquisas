import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

import { runWithTenant } from '../tenancy/tenant-context.js';
import type { AuthenticatedRequest } from './decorators.js';

/** Runs every authenticated handler inside the actor's organization (TenantContext). */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const actor = context.switchToHttp().getRequest<AuthenticatedRequest>().actor;
    if (!actor) {
      return next.handle();
    }
    return new Observable((subscriber) =>
      runWithTenant(actor.organizationId, () => next.handle().subscribe(subscriber)),
    );
  }
}
