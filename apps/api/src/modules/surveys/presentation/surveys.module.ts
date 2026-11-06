import { Module } from '@nestjs/common';

import type { Database } from '../../../shared/database/database.js';
import { DATABASE } from '../../../shared/database/database.token.js';
import type { SurveysDeps } from '../application/surveys-deps.js';
import { createSurveysDeps } from '../infrastructure/surveys-deps.factory.js';
import { ClientsController } from './clients.controller.js';
import { SurveysController } from './surveys.controller.js';
import { SURVEYS_DEPS } from './surveys.tokens.js';

@Module({
  controllers: [ClientsController, SurveysController],
  providers: [
    {
      provide: SURVEYS_DEPS,
      inject: [DATABASE],
      useFactory: (database: Database): SurveysDeps => createSurveysDeps({ database }),
    },
  ],
})
export class SurveysModule {}
