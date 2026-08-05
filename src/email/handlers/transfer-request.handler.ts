import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TransferRequestTemplate } from '../templates/transfer-request.template';
import { TransferRequestCreatedEvent, TransferRequestResolvedEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { TypeOrmMailboxRepository } from '../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmWorkspaceEmailSenderRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-email-sender.repository';
import { TypeOrmTicketRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { sendWorkspaceEmail } from '../domain/resolve-email-sender';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';

@Injectable()
export class TransferRequestHandler {
  private readonly logger = new Logger(TransferRequestHandler.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    private readonly idGenerator: UlidGenerator,
    private readonly mailboxRepository: TypeOrmMailboxRepository,
    private readonly ticketRepository: TypeOrmTicketRepository,
    private readonly emailSenderRepository: TypeOrmWorkspaceEmailSenderRepository,
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173').split(',')[0].trim();
  }

  @OnEvent('transfer-request.created')
  async handleCreated(event: TransferRequestCreatedEvent): Promise<void> {
    const users = await this.userRepository.findByIds([event.targetUserId]);
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.TRANSFER_REQUEST,
      title: `${event.requesterName}: ${event.ticketName}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppTicketAssigned',
      emailPrefKey: 'emailTicketAssigned',
    });

    if (emailRecipients.size === 0) return;

    const template = new TransferRequestTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const ticket = await this.ticketRepository.findById(event.ticketId);
    const mailbox = ticket?.mailboxId
      ? await this.mailboxRepository.findById(ticket.mailboxId)
      : null;
    const emailDomain = mailbox ? mailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    for (const [lang, emails] of emailRecipients) {
      await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject: template.createdSubject({ ticketName: event.ticketName, ticketUrl, requesterName: event.requesterName, workspaceName: event.workspaceName, lang }),
        html: template.createdHtml({ ticketName: event.ticketName, ticketUrl, requesterName: event.requesterName, workspaceName: event.workspaceName, lang }),
        ...(emailDomain && {
          messageId: `<transfer-${event.requestId}@${emailDomain}>`,
          inReplyTo: `<ticket-${event.ticketId}@${emailDomain}>`,
          references: `<ticket-${event.ticketId}@${emailDomain}>`,
        }),
        ...(mailbox && { replyTo: mailbox.address }),
      });
    }
  }

  @OnEvent('transfer-request.resolved')
  async handleResolved(event: TransferRequestResolvedEvent): Promise<void> {
    // Notify requester on accept/reject, notify target on cancel
    const notifyUserId = event.resolution === 'cancelled' ? event.targetUserId : event.requesterId;
    const users = await this.userRepository.findByIds([notifyUserId]);
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.TRANSFER_REQUEST,
      title: `${event.ticketName}: transfer ${event.resolution}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppTicketAssigned',
      emailPrefKey: 'emailTicketAssigned',
    });

    if (emailRecipients.size === 0) return;

    const template = new TransferRequestTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const ticket = await this.ticketRepository.findById(event.ticketId);
    const mailbox = ticket?.mailboxId
      ? await this.mailboxRepository.findById(ticket.mailboxId)
      : null;
    const emailDomain = mailbox ? mailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    for (const [lang, emails] of emailRecipients) {
      await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject: template.resolvedSubject({ ticketName: event.ticketName, ticketUrl, resolution: event.resolution, workspaceName: event.workspaceName, lang }),
        html: template.resolvedHtml({ ticketName: event.ticketName, ticketUrl, resolution: event.resolution, workspaceName: event.workspaceName, lang }),
        ...(emailDomain && {
          inReplyTo: `<transfer-${event.requestId}@${emailDomain}>`,
          references: `<ticket-${event.ticketId}@${emailDomain}>`,
        }),
        ...(mailbox && { replyTo: mailbox.address }),
      });
    }
  }
}
