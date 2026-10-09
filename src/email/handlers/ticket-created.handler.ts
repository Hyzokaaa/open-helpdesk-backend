import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { ResolveWorkspaceAdmins } from '../../notification/domain/services/notification-resolve-workspace-admins';
import { sendWorkspaceEmail } from '../domain/resolve-email-sender';
import { TypeOrmTicketRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmTicketParticipantRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket-participant.repository';
import { TypeOrmAuditLogRepository } from '../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { ResolveTicketStakeholders } from '../../notification/domain/services/notification-resolve-ticket-stakeholders';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';
import { WorkspaceFrontendResolver } from '../../shared/infrastructure/workspace-frontend-resolver';
import { RecordEmailSend } from '../../audit-log/domain/services/audit-log-record-email-send';

import { TypeOrmTicketCategoryRepository } from '../../project/infrastructure/typeorm/repositories/typeorm-ticket-category.repository';

@Injectable()
export class TicketCreatedHandler {
  private readonly logger = new Logger(TicketCreatedHandler.name);

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
    private readonly auditLogRepository: TypeOrmAuditLogRepository,
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
    private readonly frontendResolver: WorkspaceFrontendResolver,
    private readonly categoryRepository: TypeOrmTicketCategoryRepository,
  ) {}

  @OnEvent('ticket.created')
  async handle(event: TicketCreatedEvent): Promise<void> {
    await this.notifyStakeholders(event);
    await this.sendReporterConfirmation(event);
  }

  private async notifyStakeholders(event: TicketCreatedEvent): Promise<void> {
    const resolveStakeholders = new ResolveTicketStakeholders(this.ticketRepository, this.participantRepository, this.userRepository);
    const ticketStakeholders = await resolveStakeholders.execute({
      ticketId: event.ticketId,
      excludeUserId: event.reporterId,
    });

    const resolveAdmins = new ResolveWorkspaceAdmins(this.memberRepository, this.userRepository);
    const admins = await resolveAdmins.execute({
      workspaceId: event.workspaceId,
      excludeUserId: event.reporterId,
    });

    const stakeholderIds = new Set(ticketStakeholders.map((u) => u.getId()));
    const extraAdmins = admins.filter((u) => !stakeholderIds.has(u.getId()));

    const users = [...ticketStakeholders, ...extraAdmins];
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.TICKET_CREATED,
      title: `${event.reporterName}: ${event.ticketName}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppTicketCreated',
      emailPrefKey: 'emailTicketCreated',
    });

    if (emailRecipients.size === 0) return;

    const template = new TicketCreatedTemplate();
    const frontendUrl = await this.frontendResolver.resolve(event.workspaceId);
    const ticketUrl = `${frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const mailbox = event.mailboxId
      ? await this.mailboxRepository.findById(event.mailboxId)
      : null;
    const emailDomain = mailbox ? mailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);
    // The event carries the category id; recipients need its name
    const category = event.categoryId ? await this.categoryRepository.findById(event.categoryId) : null;
    const categoryName = category?.name ?? '';

    for (const [lang, emails] of emailRecipients) {
      const subject = template.subject({ ticketName: event.ticketName, ticketUrl, reporterName: event.reporterName, priority: event.priority, category: categoryName, workspaceName: event.workspaceName, lang });
      const result = await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject,
        html: template.html({ ticketName: event.ticketName, ticketUrl, reporterName: event.reporterName, priority: event.priority, category: categoryName, workspaceName: event.workspaceName, lang }),
        ...(emailDomain && { messageId: `<ticket-${event.ticketId}@${emailDomain}>` }),
        ...(mailbox && { replyTo: mailbox.address }),
      });
      await new RecordEmailSend(this.idGenerator, this.auditLogRepository).execute({
        result, type: 'ticket-notification', to: emails, subject, workspaceId: event.workspaceId, ticketId: event.ticketId, ticketName: event.ticketName,
      });
    }
  }

  private async sendReporterConfirmation(event: TicketCreatedEvent): Promise<void> {
    if (!event.portalToken) return;

    if (event.source === 'email' && event.mailboxId) {
      const sourceMailbox = await this.mailboxRepository.findById(event.mailboxId);
      if (sourceMailbox && sourceMailbox.autoReply === false) return;
    }

    const creator = await this.userRepository.findById(event.reporterId);
    if (!creator) return;

    const lang = creator.language || 'en';
    const frontendUrl = await this.frontendResolver.resolve(event.workspaceId);
    const portalUrl = `${frontendUrl}/portal/tickets/${event.portalToken}`;
    const template = new TicketConfirmationTemplate();
    const mailbox = event.mailboxId
      ? await this.mailboxRepository.findById(event.mailboxId)
      : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    const subject = template.subject({ ticketName: event.ticketName, portalUrl, lang });
    const result = await sendWorkspaceEmail(this.emailService, sender, {
      to: [creator.email],
      subject,
      html: template.html({ ticketName: event.ticketName, portalUrl, lang }),
      ...(mailbox && { replyTo: mailbox.address }),
    });
    await new RecordEmailSend(this.idGenerator, this.auditLogRepository).execute({
      result, type: 'confirmation', to: [creator.email], subject, workspaceId: event.workspaceId, ticketId: event.ticketId, ticketName: event.ticketName,
    });
  }
}
