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
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { ResolveWorkspaceAdmins } from '../../notification/domain/services/notification-resolve-workspace-admins';
import { sendWorkspaceEmail } from '../domain/resolve-email-sender';
import { TypeOrmTicketRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { TypeOrmTicketParticipantRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket-participant.repository';
import { TypeOrmAuditLogRepository } from '../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../audit-log/domain/enums/audit-level.enum';
import { ResolveTicketStakeholders } from '../../notification/domain/services/notification-resolve-ticket-stakeholders';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';

@Injectable()
export class TicketCreatedHandler {
  private readonly logger = new Logger(TicketCreatedHandler.name);
  private readonly frontendUrl: string;

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
    private readonly config: ConfigService,
  ) {
    this.frontendUrl = config.get('FRONTEND_URL', 'http://localhost:5173');
  }

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
    const ticketUrl = `${this.frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const mailbox = event.mailboxId
      ? await this.mailboxRepository.findById(event.mailboxId)
      : null;
    const emailDomain = mailbox ? mailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    for (const [lang, emails] of emailRecipients) {
      const result = await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject: template.subject({ ticketName: event.ticketName, ticketUrl, reporterName: event.reporterName, priority: event.priority, category: event.category, workspaceName: event.workspaceName, lang }),
        html: template.html({ ticketName: event.ticketName, ticketUrl, reporterName: event.reporterName, priority: event.priority, category: event.category, workspaceName: event.workspaceName, lang }),
        ...(emailDomain && { messageId: `<ticket-${event.ticketId}@${emailDomain}>` }),
        ...(mailbox && { replyTo: mailbox.address }),
      });
      if (!result.success) {
        const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
        await auditLog.execute({
          action: AuditAction.EMAIL_SEND_FAILED,
          entityType: 'email',
          entityId: event.ticketId,
          userId: null,
          workspaceId: event.workspaceId,
          metadata: { reason: 'notification', to: emails, ticketId: event.ticketId },
          category: AuditCategory.EMAIL,
          level: AuditLevel.ERROR,
          source: 'system',
        }).catch(() => {});
      } else {
        const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
        await auditLog.execute({
          action: AuditAction.EMAIL_SENT,
          entityType: 'email',
          entityId: event.ticketId,
          userId: null,
          workspaceId: event.workspaceId,
          metadata: { to: emails, ticketId: event.ticketId, type: 'ticket-notification' },
          category: AuditCategory.EMAIL,
          level: AuditLevel.INFO,
          source: 'system',
        }).catch(() => {});
      }
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
    const portalUrl = `${this.frontendUrl}/portal/tickets/${event.portalToken}`;
    const template = new TicketConfirmationTemplate();
    const mailbox = event.mailboxId
      ? await this.mailboxRepository.findById(event.mailboxId)
      : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    const result = await sendWorkspaceEmail(this.emailService, sender, {
      to: [creator.email],
      subject: template.subject({ ticketName: event.ticketName, portalUrl, lang }),
      html: template.html({ ticketName: event.ticketName, portalUrl, lang }),
      ...(mailbox && { replyTo: mailbox.address }),
    });
    if (!result.success) {
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.EMAIL_SEND_FAILED,
        entityType: 'email',
        entityId: event.ticketId,
        userId: null,
        workspaceId: event.workspaceId,
        metadata: { reason: 'notification', to: creator.email, ticketId: event.ticketId },
        category: AuditCategory.EMAIL,
        level: AuditLevel.ERROR,
        source: 'system',
      }).catch(() => {});
    } else {
      const auditLog = new CreateAuditLogEntry(this.idGenerator, this.auditLogRepository);
      await auditLog.execute({
        action: AuditAction.EMAIL_SENT,
        entityType: 'email',
        entityId: event.ticketId,
        userId: null,
        workspaceId: event.workspaceId,
        metadata: { to: [creator.email], ticketId: event.ticketId, type: 'confirmation' },
        category: AuditCategory.EMAIL,
        level: AuditLevel.INFO,
        source: 'system',
      }).catch(() => {});
    }
  }
}
