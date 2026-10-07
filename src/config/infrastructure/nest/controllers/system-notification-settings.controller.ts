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
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';
import { AccessDeniedError } from '../../../../shared/domain/errors';
import { SystemNotificationSettings } from '../../../domain/entities/system-notification-settings';
import { TypeOrmSystemNotificationSettingsRepository } from '../../typeorm/repositories/typeorm-system-notification-settings.repository';

@Controller('admin')
export class SystemNotificationSettingsController {
  constructor(
    @Inject() private readonly repository: TypeOrmSystemNotificationSettingsRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
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

    const before = { upgradeEnabled: settings.upgradeEnabled, upgradeEmail: settings.upgradeEmail, upgradeInApp: settings.upgradeInApp };
    if (body.upgradeEnabled !== undefined) settings.upgradeEnabled = body.upgradeEnabled;
    if (body.upgradeEmail !== undefined) settings.upgradeEmail = body.upgradeEmail;
    if (body.upgradeInApp !== undefined) settings.upgradeInApp = body.upgradeInApp;

    await this.repository.save(settings);

    const after = { upgradeEnabled: settings.upgradeEnabled, upgradeEmail: settings.upgradeEmail, upgradeInApp: settings.upgradeInApp };
    await new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository).execute({
      action: AuditAction.SYSTEM_NOTIFICATION_SETTINGS_UPDATED,
      entityType: 'system',
      entityId: 'notification-settings',
      userId: user.userId,
      workspaceId: null,
      metadata: { before, after },
      category: AuditCategory.SYSTEM,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return after;
  }
}
