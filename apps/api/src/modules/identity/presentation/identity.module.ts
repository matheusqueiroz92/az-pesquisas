import { Module } from '@nestjs/common';

import { ACCESS_TOKEN_VERIFIER } from '../../../shared/auth/actor.js';
import type { AccessTokenVerifier } from '../../../shared/auth/actor.js';
import type { AppConfig } from '../../../shared/config/app-config.js';
import { APP_CONFIG } from '../../../shared/config/app-config.token.js';
import type { Database } from '../../../shared/database/database.js';
import { DATABASE } from '../../../shared/database/database.token.js';
import { MAILER } from '../../../shared/mail/mailer.js';
import type { Mailer } from '../../../shared/mail/mailer.js';
import type { IdentityDeps } from '../application/identity-deps.js';
import { createIdentityDeps } from '../infrastructure/identity-deps.factory.js';
import { AuthController } from './auth.controller.js';
import { IDENTITY_DEPS } from './identity.tokens.js';
import { UsersController } from './users.controller.js';

@Module({
  controllers: [AuthController, UsersController],
  providers: [
    {
      provide: IDENTITY_DEPS,
      inject: [DATABASE, APP_CONFIG, MAILER],
      useFactory: (database: Database, config: AppConfig, mailer: Mailer): IdentityDeps =>
        createIdentityDeps({
          database,
          jwtSecret: config.jwtSecret,
          panelUrl: config.panelUrl,
          mailer,
        }),
    },
    {
      provide: ACCESS_TOKEN_VERIFIER,
      inject: [IDENTITY_DEPS],
      useFactory: (deps: IdentityDeps): AccessTokenVerifier => deps.accessTokens,
    },
  ],
  exports: [ACCESS_TOKEN_VERIFIER],
})
export class IdentityModule {}
