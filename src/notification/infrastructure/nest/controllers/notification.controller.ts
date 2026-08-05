import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmNotificationRepository } from '../../typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../typeorm/repositories/typeorm-notification-preference.repository';
import { UpdateNotificationPreference } from '../../../domain/services/notification-preference-update';
import { UpdatePreferencesCommand } from '../../../application/commands/update-preferences.command';
import { ListNotificationsQuery } from '../../../application/queries/list-notifications.query';
import { GetPreferencesQuery } from '../../../application/queries/get-preferences.query';
import { TypeOrmAuditLogRepository } from '../../../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../../audit-log/domain/enums/audit-level.enum';

@Controller('notifications')
export class NotificationController {
  constructor(
    @Inject()
    private readonly notificationRepository: TypeOrmNotificationRepository,
    @Inject()
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
    @Inject() private readonly auditLogRepository: TypeOrmAuditLogRepository,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('unreadOnly') unreadOnly: string,
  ) {
    const query = new ListNotificationsQuery(this.notificationRepository);
    return query.execute({ userId: user.userId, unreadOnly: unreadOnly === 'true' });
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.notificationRepository.markAsRead(id, user.userId);
    return { success: true };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser() user: AuthUser) {
    await this.notificationRepository.markAllAsRead(user.userId);
    return { success: true };
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthUser) {
    const query = new GetPreferencesQuery(this.preferenceRepository);
    return query.execute({ userId: user.userId });
  }

  @Put('preferences')
  async updatePreferences(
    @Body() body: Record<string, boolean>,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new UpdateNotificationPreference(this.idGenerator, this.preferenceRepository);
    const command = new UpdatePreferencesCommand(service);
    const result = await command.execute({ userId: user.userId, ...body });

    const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
    await auditLog.execute({
      action: AuditAction.NOTIFICATION_PREFERENCES_UPDATED,
      entityType: 'notification-preferences',
      entityId: user.userId,
      userId: user.userId,
      workspaceId: null,
      metadata: body,
      category: AuditCategory.CONFIG,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return result;
  }
}
