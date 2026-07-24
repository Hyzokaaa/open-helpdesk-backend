import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TicketCreatedTemplate } from '../templates/ticket-created.template';
import { TicketConfirmationTemplate } from '../templates/ticket-confirmation.template';
import { TicketCreatedEvent } from '../domain/events';
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
export class TicketCreatedHandler {
  private readonly logger = new Logger(TicketCreatedHandler.name);
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

  @OnEvent('ticket.created')
  async handle(event: TicketCreatedEvent): Promise<void> {
    await this.notifyStakeholders(event);
    await this.sendCreatorConfirmation(event);
  }

  private async notifyStakeholders(event: TicketCreatedEvent): Promise<void> {
    const resolveStakeholders = new ResolveTicketStakeholders(this.ticketRepository, this.participantRepository, this.userRepository);
    const users = await resolveStakeholders.execute({
      ticketId: event.ticketId,
      excludeUserId: event.creatorId,
    });
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.TICKET_CREATED,
      title: `${event.creatorName}: ${event.ticketName}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppTicketCreated',
      emailPrefKey: 'emailTicketCreated',
    });

    if (emailRecipients.size === 0) return;

    const template = new TicketCreatedTemplate();
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const mailbox = this.emailDomain ? await this.mailboxRepository.findByWorkspaceId(event.workspaceId) : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    for (const [lang, emails] of emailRecipients) {
      await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject: template.subject({ ticketName: event.ticketName, ticketUrl, creatorName: event.creatorName, priority: event.priority, category: event.category, workspaceName: event.workspaceName, lang }),
        html: template.html({ ticketName: event.ticketName, ticketUrl, creatorName: event.creatorName, priority: event.priority, category: event.category, workspaceName: event.workspaceName, lang }),
        ...(this.emailDomain && { messageId: `<ticket-${event.ticketId}@${this.emailDomain}>` }),
        ...(mailbox && { replyTo: mailbox.address }),
      });
    }
  }

  private async sendCreatorConfirmation(event: TicketCreatedEvent): Promise<void> {
    if (!event.portalToken) return;

    const creator = await this.userRepository.findById(event.creatorId);
    if (!creator) return;

    const lang = creator.language || 'en';
    const portalUrl = `${this.frontendUrl}/portal/tickets/${event.portalToken}`;
    const template = new TicketConfirmationTemplate();
    const mailbox = this.emailDomain ? await this.mailboxRepository.findByWorkspaceId(event.workspaceId) : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    await sendWorkspaceEmail(this.emailService, sender, {
      to: [creator.email],
      subject: template.subject({ ticketName: event.ticketName, portalUrl, lang }),
      html: template.html({ ticketName: event.ticketName, portalUrl, lang }),
      ...(mailbox && { replyTo: mailbox.address }),
    });
  }
}
