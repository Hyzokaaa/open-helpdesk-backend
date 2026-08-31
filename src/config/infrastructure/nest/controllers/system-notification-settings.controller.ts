import {
  Body,
  Controller,
  Get,
  Inject,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { SystemNotificationSettings } from '../../../domain/entities/system-notification-settings';
import { TypeOrmSystemNotificationSettingsRepository } from '../../typeorm/repositories/typeorm-system-notification-settings.repository';

@Controller('admin')
export class SystemNotificationSettingsController {
  constructor(
    @Inject() private readonly repository: TypeOrmSystemNotificationSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
  ) {}

  private ensureAdmin(user: AuthUser) {
    if (!user.isSystemAdmin) throw new AccessDeniedError('System admin required');
  }

  @Get('notification-settings')
  async get(@CurrentUser() user: AuthUser) {
    this.ensureAdmin(user);
    let settings = await this.repository.find();
    if (!settings) {
      settings = new SystemNotificationSettings({
        id: this.idGenerator.create(),
        upgradeEnabled: true,
        upgradeEmail: true,
        upgradeInApp: true,
        lastNotifiedVersion: null,
      });
      await this.repository.save(settings);
    }
    return {
      upgradeEnabled: settings.upgradeEnabled,
      upgradeEmail: settings.upgradeEmail,
      upgradeInApp: settings.upgradeInApp,
    };
  }

  @Put('notification-settings')
  async update(
    @Body() body: { upgradeEnabled?: boolean; upgradeEmail?: boolean; upgradeInApp?: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    this.ensureAdmin(user);

    let settings = await this.repository.find();
    if (!settings) {
      settings = new SystemNotificationSettings({
        id: this.idGenerator.create(),
        upgradeEnabled: true,
        upgradeEmail: true,
        upgradeInApp: true,
        lastNotifiedVersion: null,
      });
    }

    if (body.upgradeEnabled !== undefined) settings.upgradeEnabled = body.upgradeEnabled;
    if (body.upgradeEmail !== undefined) settings.upgradeEmail = body.upgradeEmail;
    if (body.upgradeInApp !== undefined) settings.upgradeInApp = body.upgradeInApp;

    await this.repository.save(settings);

    return {
      upgradeEnabled: settings.upgradeEnabled,
      upgradeEmail: settings.upgradeEmail,
      upgradeInApp: settings.upgradeInApp,
    };
  }
}
