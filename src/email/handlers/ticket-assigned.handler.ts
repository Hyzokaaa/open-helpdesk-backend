import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TicketAssignedTemplate } from '../templates/ticket-assigned.template';
import { TicketAssignedEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { TypeOrmMailboxRepository } from '../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmWorkspaceEmailSenderRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-email-sender.repository';
import { TypeOrmTicketRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket.repository';
import { sendWorkspaceEmail } from '../domain/resolve-email-sender';
import { TypeOrmAuditLogRepository } from '../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { CreateAuditLogEntry } from '../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../audit-log/domain/enums/audit-level.enum';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';
import { WorkspaceFrontendResolver } from '../../shared/infrastructure/workspace-frontend-resolver';

@Injectable()
export class TicketAssignedHandler {
  private readonly logger = new Logger(TicketAssignedHandler.name);

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly userRepository: TypeOrmUserRepository,
    private readonly notificationRepository: TypeOrmNotificationRepository,
    private readonly preferenceRepository: TypeOrmNotificationPreferenceRepository,
    private readonly idGenerator: UlidGenerator,
    private readonly mailboxRepository: TypeOrmMailboxRepository,
    private readonly ticketRepository: TypeOrmTicketRepository,
    private readonly emailSenderRepository: TypeOrmWorkspaceEmailSenderRepository,
    private readonly auditLogRepository: TypeOrmAuditLogRepository,
    private readonly frontendResolver: WorkspaceFrontendResolver,
  ) {}

  @OnEvent('ticket.assigned')
  async handle(event: TicketAssignedEvent): Promise<void> {
    const template = new TicketAssignedTemplate();
    const frontendUrl = await this.frontendResolver.resolve(event.workspaceId);
    const ticketUrl = `${frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const ticket = await this.ticketRepository.findById(event.ticketId);
    const mailbox = ticket?.mailboxId
      ? await this.mailboxRepository.findById(ticket.mailboxId)
      : null;
    const emailDomain = mailbox ? mailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);
    const threading = emailDomain ? {
      inReplyTo: `<ticket-${event.ticketId}@${emailDomain}>`,
      references: `<ticket-${event.ticketId}@${emailDomain}>`,
    } : {};

    // Unassigned — notify previous assignee
    if (event.previousAssigneeId && event.previousAssigneeId !== event.newAssigneeId) {
      const prevUsers = await this.userRepository.findByIds([event.previousAssigneeId]);
      if (prevUsers.length > 0) {
        const { emailRecipients } = await dispatch.execute({
          users: prevUsers,
          type: NotificationType.TICKET_ASSIGNED,
          title: `Unassigned: ${event.ticketName}`,
          ticketId: event.ticketId,
          workspaceSlug: event.workspaceSlug,
          inAppPrefKey: 'inAppTicketAssigned',
          emailPrefKey: 'emailTicketAssigned',
        });

        for (const [lang, emails] of emailRecipients) {
          const data = { ticketName: event.ticketName, ticketUrl, workspaceName: event.workspaceName, lang };
          const result = await sendWorkspaceEmail(this.emailService, sender, {
            to: emails,
            subject: template.unassignedSubject(data),
            html: template.unassignedHtml(data),
            ...(emailDomain && { messageId: `<assign-${event.ticketId}-${Date.now()}@${emailDomain}>` }),
            ...threading,
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
              metadata: { to: emails, ticketId: event.ticketId, type: 'assignment' },
              category: AuditCategory.EMAIL,
              level: AuditLevel.INFO,
              source: 'system',
            }).catch(() => {});
          }
        }
      }
    }

    // Assigned — notify new assignee
    if (event.newAssigneeId) {
      const newUsers = await this.userRepository.findByIds([event.newAssigneeId]);
      if (newUsers.length > 0) {
        const { emailRecipients } = await dispatch.execute({
          users: newUsers,
          type: NotificationType.TICKET_ASSIGNED,
          title: `Assigned: ${event.ticketName}`,
          ticketId: event.ticketId,
          workspaceSlug: event.workspaceSlug,
          inAppPrefKey: 'inAppTicketAssigned',
          emailPrefKey: 'emailTicketAssigned',
        });

        for (const [lang, emails] of emailRecipients) {
          const data = {
            ticketName: event.ticketName,
            ticketUrl,
            assigneeName: `${newUsers[0].firstName} ${newUsers[0].lastName}`,
            workspaceName: event.workspaceName,
            lang,
          };
          const result = await sendWorkspaceEmail(this.emailService, sender, {
            to: emails,
            subject: template.assignedSubject(data),
            html: template.assignedHtml(data),
            ...(emailDomain && { messageId: `<assign-${event.ticketId}-${Date.now()}@${emailDomain}>` }),
            ...threading,
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
              metadata: { to: emails, ticketId: event.ticketId, type: 'assignment' },
              category: AuditCategory.EMAIL,
              level: AuditLevel.INFO,
              source: 'system',
            }).catch(() => {});
          }
        }
      }
    }
  }
}
