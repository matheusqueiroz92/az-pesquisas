import { Module } from '@nestjs/common';

import type { Database } from '../../../shared/database/database.js';
import { DATABASE } from '../../../shared/database/database.token.js';
import type { DevicesDeps } from '../application/devices-deps.js';
import { createDevicesDeps } from '../infrastructure/devices-deps.factory.js';
import { DeviceAppController } from './device-app.controller.js';
import { DevicesController } from './devices.controller.js';
import { DEVICES_DEPS } from './devices.tokens.js';
import { TeamsController } from './teams.controller.js';

@Module({
  controllers: [DeviceAppController, DevicesController, TeamsController],
  providers: [
    {
      provide: DEVICES_DEPS,
      inject: [DATABASE],
      useFactory: (database: Database): DevicesDeps => createDevicesDeps({ database }),
    },
  ],
})
export class DevicesModule {}
