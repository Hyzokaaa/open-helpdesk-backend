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
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
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

    const cleanContent = event.commentContent.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
    const preview = cleanContent.length > 200 ? cleanContent.substring(0, 200) + '...' : cleanContent;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.COMMENT_CREATED,
      title: `${event.authorName}: ${preview.substring(0, 100)}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppCommentCreated',
      emailPrefKey: 'emailCommentCreated',
    });

    if (emailRecipients.size === 0) return;

    const template = new NewCommentTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;

    for (const [lang, emails] of emailRecipients) {
      await this.emailService.send({
        to: emails,
        subject: template.subject({ ticketName: event.ticketName, ticketUrl, authorName: event.authorName, commentPreview: preview, workspaceName: event.workspaceName, lang }),
        html: template.html({ ticketName: event.ticketName, ticketUrl, authorName: event.authorName, commentPreview: preview, workspaceName: event.workspaceName, lang }),
      });
    }
  }
}
