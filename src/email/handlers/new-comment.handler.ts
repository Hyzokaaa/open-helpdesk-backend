import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { NewCommentTemplate } from '../templates/new-comment.template';
import { NewCommentEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { Notification } from '../../notification/domain/entities/notification';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';

@Injectable()
export class NewCommentHandler {
  private readonly logger = new Logger(NewCommentHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    private readonly idGenerator: UlidGenerator,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

  @OnEvent('comment.created')
  async handle(event: NewCommentEvent): Promise<void> {
    const recipientIds = new Set<string>();

    if (event.assigneeId && event.assigneeId !== event.authorId) {
      recipientIds.add(event.assigneeId);
    }
    for (const userId of event.mentionedUserIds) {
      if (userId !== event.authorId) recipientIds.add(userId);
    }
    if (recipientIds.size === 0) return;

    const users = await this.userRepository.findByIds([...recipientIds]);
    if (users.length === 0) return;

    const userIds = users.map((u) => u.getId());
    const prefs = await this.preferenceRepository.findByUserIds(userIds);

    const cleanContent = event.commentContent.replace(
      /@\[([^\]]+)\]\([^)]+\)/g,
      '@$1',
    );
    const preview =
      cleanContent.length > 200
        ? cleanContent.substring(0, 200) + '...'
        : cleanContent;

    // In-app notifications
    for (const user of users) {
      const pref = prefs.get(user.getId());
      if (!pref || (pref.inAppEnabled && pref.inAppCommentCreated)) {
        await this.notificationRepository.create(
          new Notification({
            id: this.idGenerator.create(),
            userId: user.getId(),
            type: NotificationType.COMMENT_CREATED,
            title: `${event.authorName}: ${preview.substring(0, 100)}`,
            ticketId: event.ticketId,
            workspaceSlug: event.workspaceSlug,
            isRead: false,
          }),
        );
      }
    }

    // Email notifications
    const emailUsers = users.filter((u) => {
      const pref = prefs.get(u.getId());
      return !pref || (pref.emailEnabled && pref.emailCommentCreated);
    });
    if (emailUsers.length === 0) return;

    const template = new NewCommentTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    const byLang = new Map<string, string[]>();
    for (const u of emailUsers) {
      const lang = u.language || 'en';
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang)!.push(u.email);
    }

    for (const [lang, emails] of byLang) {
      const data = {
        ticketName: event.ticketName,
        ticketUrl,
        authorName: event.authorName,
        commentPreview: preview,
        workspaceName: event.workspaceName,
        lang,
      };

      await this.emailService.send({
        to: emails,
        subject: template.subject(data),
        html: template.html(data),
      });
    }
  }
}
