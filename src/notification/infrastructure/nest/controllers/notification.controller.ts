import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmNotificationRepository } from '../../typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../typeorm/repositories/typeorm-notification-preference.repository';
import { UpdateNotificationPreference } from '../../../domain/services/notification-preference-update';
import { UpdatePreferencesCommand } from '../../../application/commands/update-preferences.command';
import { ListNotificationsQuery } from '../../../application/queries/list-notifications.query';
import { GetPreferencesQuery } from '../../../application/queries/get-preferences.query';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(
    @Inject()
    private readonly notificationRepository: TypeOrmNotificationRepository,
    @Inject()
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    @Inject() private readonly idGenerator: UlidGenerator,
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
  updatePreferences(
    @Body() body: Record<string, boolean>,
    @CurrentUser() user: AuthUser,
  ) {
    const service = new UpdateNotificationPreference(this.idGenerator, this.preferenceRepository);
    const command = new UpdatePreferencesCommand(service);
    return command.execute({ userId: user.userId, ...body });
  }
}
