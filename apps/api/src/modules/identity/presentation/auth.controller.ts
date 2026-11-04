import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ChangePasswordRequest,
  LoginRequest,
  LogoutRequest,
  PasswordResetConfirm,
  PasswordResetRequest,
  RefreshRequest,
} from '@az-pesquisas/contracts';
import type { MeResponse, TokenResponse } from '@az-pesquisas/contracts';

import type { Actor } from '../../../shared/auth/actor.js';
import { CurrentActor, Public } from '../../../shared/auth/decorators.js';
import { ZodValidationPipe } from '../../../shared/http/zod-validation.pipe.js';
import { getMe, login, logout, refreshSession } from '../application/authentication.js';
import type { AuthResult } from '../application/authentication.js';
import type { IdentityDeps } from '../application/identity-deps.js';
import {
  changePassword,
  confirmPasswordReset,
  requestPasswordReset,
} from '../application/password.js';
import { httpError } from './http-errors.js';
import { IDENTITY_DEPS } from './identity.tokens.js';

const toTokenResponse = (result: AuthResult): TokenResponse => ({
  accessToken: result.accessToken,
  accessTokenExpiresAt: result.accessTokenExpiresAt.toISOString(),
  refreshToken: result.refreshToken,
  refreshTokenExpiresAt: result.refreshTokenExpiresAt.toISOString(),
  user: result.user,
});

const MINUTE = 60_000;

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(IDENTITY_DEPS) private readonly deps: IdentityDeps) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(LoginRequest)) body: LoginRequest,
  ): Promise<TokenResponse> {
    const result = await login(this.deps, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toTokenResponse(result.value);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshRequest)) body: RefreshRequest,
  ): Promise<TokenResponse> {
    const result = await refreshSession(this.deps, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return toTokenResponse(result.value);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body(new ZodValidationPipe(LogoutRequest)) body: LogoutRequest): Promise<void> {
    await logout(this.deps, body);
  }

  @Get('me')
  async me(@CurrentActor() actor: Actor): Promise<MeResponse> {
    const result = await getMe(this.deps, actor);
    if (!result.ok) {
      throw httpError(result.error);
    }
    return result.value;
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(ChangePasswordRequest)) body: ChangePasswordRequest,
  ): Promise<void> {
    const result = await changePassword(this.deps, actor, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE } })
  @Post('password-reset')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(
    @Body(new ZodValidationPipe(PasswordResetRequest)) body: PasswordResetRequest,
  ): Promise<void> {
    await requestPasswordReset(this.deps, body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: MINUTE } })
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmPasswordReset(
    @Body(new ZodValidationPipe(PasswordResetConfirm)) body: PasswordResetConfirm,
  ): Promise<void> {
    const result = await confirmPasswordReset(this.deps, body);
    if (!result.ok) {
      throw httpError(result.error);
    }
  }
}
