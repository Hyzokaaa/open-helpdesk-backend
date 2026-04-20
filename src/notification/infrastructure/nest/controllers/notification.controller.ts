import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../../../shared/nest/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/nest/decorators/current-user.decorator';
import { AuthUser } from '../../../../shared/nest/strategies/jwt.strategy';
import { UlidGenerator } from '../../../../shared/infrastructure/ulid-generator';
import { TypeOrmNotificationRepository } from '../../typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../typeorm/repositories/typeorm-notification-preference.repository';
import { NotificationPreference } from '../../../domain/entities/notification-preference';

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
  async list(
    @CurrentUser() user: AuthUser,
    @Query('unreadOnly') unreadOnly: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const unread = unreadOnly === 'true';
    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepository.findByUserId(user.userId, unread),
      this.notificationRepository.countUnread(user.userId),
    ]);

    res.setHeader('X-Unread-Count', unreadCount.toString());

    return notifications.map((n) => ({
      id: n.getId(),
      type: n.type,
      title: n.title,
      ticketId: n.ticketId,
      workspaceSlug: n.workspaceSlug,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }));
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
  async getPreferences(@CurrentUser() user: AuthUser) {
    const pref = await this.preferenceRepository.findByUserId(user.userId);

    if (!pref) {
      return {
        emailEnabled: true,
        inAppEnabled: true,
        emailTicketCreated: true,
        emailTicketAssigned: true,
        emailStatusChanged: true,
        emailCommentCreated: true,
        inAppTicketCreated: true,
        inAppTicketAssigned: true,
        inAppStatusChanged: true,
        inAppCommentCreated: true,
      };
    }

    return {
      emailEnabled: pref.emailEnabled,
      inAppEnabled: pref.inAppEnabled,
      emailTicketCreated: pref.emailTicketCreated,
      emailTicketAssigned: pref.emailTicketAssigned,
      emailStatusChanged: pref.emailStatusChanged,
      emailCommentCreated: pref.emailCommentCreated,
      inAppTicketCreated: pref.inAppTicketCreated,
      inAppTicketAssigned: pref.inAppTicketAssigned,
      inAppStatusChanged: pref.inAppStatusChanged,
      inAppCommentCreated: pref.inAppCommentCreated,
    };
  }

  @Put('preferences')
  async updatePreferences(
    @Body() body: Record<string, boolean>,
    @CurrentUser() user: AuthUser,
  ) {
    let pref = await this.preferenceRepository.findByUserId(user.userId);

    if (!pref) {
      pref = new NotificationPreference({
        id: this.idGenerator.create(),
        userId: user.userId,
        emailEnabled: true,
        inAppEnabled: true,
        emailTicketCreated: true,
        emailTicketAssigned: true,
        emailStatusChanged: true,
        emailCommentCreated: true,
        inAppTicketCreated: true,
        inAppTicketAssigned: true,
        inAppStatusChanged: true,
        inAppCommentCreated: true,
      });
    }

    if (body.emailEnabled !== undefined) pref.emailEnabled = body.emailEnabled;
    if (body.inAppEnabled !== undefined) pref.inAppEnabled = body.inAppEnabled;
    if (body.emailTicketCreated !== undefined) pref.emailTicketCreated = body.emailTicketCreated;
    if (body.emailTicketAssigned !== undefined) pref.emailTicketAssigned = body.emailTicketAssigned;
    if (body.emailStatusChanged !== undefined) pref.emailStatusChanged = body.emailStatusChanged;
    if (body.emailCommentCreated !== undefined) pref.emailCommentCreated = body.emailCommentCreated;
    if (body.inAppTicketCreated !== undefined) pref.inAppTicketCreated = body.inAppTicketCreated;
    if (body.inAppTicketAssigned !== undefined) pref.inAppTicketAssigned = body.inAppTicketAssigned;
    if (body.inAppStatusChanged !== undefined) pref.inAppStatusChanged = body.inAppStatusChanged;
    if (body.inAppCommentCreated !== undefined) pref.inAppCommentCreated = body.inAppCommentCreated;

    await this.preferenceRepository.upsert(pref);

    return {
      emailEnabled: pref.emailEnabled,
      inAppEnabled: pref.inAppEnabled,
      emailTicketCreated: pref.emailTicketCreated,
      emailTicketAssigned: pref.emailTicketAssigned,
      emailStatusChanged: pref.emailStatusChanged,
      emailCommentCreated: pref.emailCommentCreated,
      inAppTicketCreated: pref.inAppTicketCreated,
      inAppTicketAssigned: pref.inAppTicketAssigned,
      inAppStatusChanged: pref.inAppStatusChanged,
      inAppCommentCreated: pref.inAppCommentCreated,
    };
  }
}
