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
import { TypeOrmMailboxRepository } from '../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmWorkspaceEmailSenderRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-email-sender.repository';
import { sendWorkspaceEmail } from '../domain/resolve-email-sender';
import { TypeOrmTicketRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmTicketParticipantRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket-participant.repository';
import { ResolveTicketStakeholders } from '../../notification/domain/services/notification-resolve-ticket-stakeholders';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';

@Injectable()
export class NewCommentHandler {
  private readonly logger = new Logger(NewCommentHandler.name);
  private readonly frontendUrl: string;
  private readonly emailDomain?: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    private readonly idGenerator: UlidGenerator,
    private readonly mailboxRepository: TypeOrmMailboxRepository,
    private readonly ticketRepository: TypeOrmTicketRepository,
    private readonly participantRepository: TypeOrmTicketParticipantRepository,
    private readonly emailSenderRepository: TypeOrmWorkspaceEmailSenderRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
    this.emailDomain = config.get<string>('EMAIL_DOMAIN');
  }

  @OnEvent('comment.created')
  async handle(event: NewCommentEvent): Promise<void> {
    const resolveStakeholders = new ResolveTicketStakeholders(this.ticketRepository, this.participantRepository, this.userRepository);
    const stakeholders = await resolveStakeholders.execute({
      ticketId: event.ticketId,
      excludeUserId: event.authorId,
    });

    // Add mentioned users who may not be stakeholders yet
    const stakeholderIds = new Set(stakeholders.map((u) => u.getId()));
    const extraMentionIds = event.mentionedUserIds.filter((id) => id !== event.authorId && !stakeholderIds.has(id));
    const extraMentioned = extraMentionIds.length > 0 ? await this.userRepository.findByIds(extraMentionIds) : [];
    const users = [...stakeholders, ...extraMentioned];

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
    const mailbox = this.emailDomain ? await this.mailboxRepository.findByWorkspaceId(event.workspaceId) : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    for (const [lang, emails] of emailRecipients) {
      await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject: template.subject({ ticketName: event.ticketName, ticketUrl, authorName: event.authorName, commentPreview: preview, workspaceName: event.workspaceName, lang }),
        html: template.html({ ticketName: event.ticketName, ticketUrl, authorName: event.authorName, commentPreview: preview, workspaceName: event.workspaceName, lang }),
        ...(this.emailDomain && {
          messageId: `<comment-${event.commentId}@${this.emailDomain}>`,
          inReplyTo: `<ticket-${event.ticketId}@${this.emailDomain}>`,
          references: `<ticket-${event.ticketId}@${this.emailDomain}>`,
        }),
        ...(mailbox && { replyTo: mailbox.address }),
      });
    }
  }
}
