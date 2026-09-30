import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { StatusChangedTemplate } from '../templates/status-changed.template';
import { StatusChangedEvent } from '../domain/events';
import { TypeOrmUserRepository } from '../../user/infrastructure/typeorm/repositories/typeorm-user.repository';
import { TypeOrmNotificationRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification.repository';
import { TypeOrmNotificationPreferenceRepository } from '../../notification/infrastructure/typeorm/repositories/typeorm-notification-preference.repository';
import { UlidGenerator } from '../../shared/infrastructure/ulid-generator';
import { TypeOrmMailboxRepository } from '../../mailbox/infrastructure/typeorm/repositories/typeorm-mailbox.repository';
import { TypeOrmWorkspaceEmailSenderRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-email-sender.repository';
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
import { WorkspaceFrontendResolver } from '../../shared/infrastructure/workspace-frontend-resolver';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { ResolveWorkspaceAdmins } from '../../notification/domain/services/notification-resolve-workspace-admins';
import { TicketStatus } from '../../ticket/domain/enums/ticket-status.enum';

// Statuses that mean someone is expected to be working the ticket. An unassigned ticket in one
// of these has left the open queue without an owner, so admins and supervisors should assign it.
const STATUSES_NEEDING_ASSIGNEE: string[] = [TicketStatus.PENDING, TicketStatus.IN_PROGRESS];

@Injectable()
export class StatusChangedHandler {
  private readonly logger = new Logger(StatusChangedHandler.name);

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
    private readonly frontendResolver: WorkspaceFrontendResolver,
    private readonly memberRepository: TypeOrmWorkspaceMemberRepository,
  ) {}

  @OnEvent('ticket.statusChanged')
  async handle(event: StatusChangedEvent): Promise<void> {
    await this.notifyUnassigned(event);
    await this.notifyStakeholders(event);
  }

  private async notifyUnassigned(event: StatusChangedEvent): Promise<void> {
    const ticket = await this.ticketRepository.findById(event.ticketId);
    if (!ticket || ticket.workspaceId !== event.workspaceId) return;
    if (ticket.assigneeId || !STATUSES_NEEDING_ASSIGNEE.includes(ticket.status)) return;

    const resolveAdmins = new ResolveWorkspaceAdmins(this.memberRepository, this.userRepository);
    const admins = await resolveAdmins.execute({ workspaceId: event.workspaceId });
    // The author is included on purpose, so whoever moved it is reminded it still needs an owner.
    // A system admin need not be a workspace member, so they are added explicitly.
    const users = admins.some((u) => u.getId() === event.changedById)
      ? admins
      : [...admins, ...(await this.userRepository.findByIds([event.changedById]))];
    if (users.length === 0) return;

    // In-app only: it is a call to action inside the app.
    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    await dispatch.execute({
      users,
      type: NotificationType.TICKET_UNASSIGNED,
      title: `${event.ticketName}: ${event.newStatus}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppTicketUnassigned',
    });
  }

  private async notifyStakeholders(event: StatusChangedEvent): Promise<void> {
    const resolveStakeholders = new ResolveTicketStakeholders(this.ticketRepository, this.participantRepository, this.userRepository);
    const users = await resolveStakeholders.execute({
      ticketId: event.ticketId,
      excludeUserId: event.changedById,
    });
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.STATUS_CHANGED,
      title: `${event.ticketName}: ${event.oldStatus} → ${event.newStatus}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppStatusChanged',
      emailPrefKey: 'emailStatusChanged',
    });

    if (emailRecipients.size === 0) return;

    const template = new StatusChangedTemplate();
    const frontendUrl = await this.frontendResolver.resolve(event.workspaceId);
    const ticketUrl = `${frontendUrl}/dashboard/workspaces/${event.workspaceSlug}/tickets/${event.ticketId}`;
    const ticket = await this.ticketRepository.findById(event.ticketId);
    const mailbox = ticket?.mailboxId
      ? await this.mailboxRepository.findById(ticket.mailboxId)
      : null;
    const emailDomain = mailbox ? mailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);

    for (const [lang, emails] of emailRecipients) {
      const result = await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject: template.subject({ ticketName: event.ticketName, ticketUrl, oldStatus: event.oldStatus, newStatus: event.newStatus, workspaceName: event.workspaceName, lang }),
        html: template.html({ ticketName: event.ticketName, ticketUrl, oldStatus: event.oldStatus, newStatus: event.newStatus, workspaceName: event.workspaceName, lang }),
        ...(emailDomain && {
          messageId: `<status-${event.ticketId}-${Date.now()}@${emailDomain}>`,
          inReplyTo: `<ticket-${event.ticketId}@${emailDomain}>`,
          references: `<ticket-${event.ticketId}@${emailDomain}>`,
        }),
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
          metadata: { to: emails, ticketId: event.ticketId, type: 'status-change' },
          category: AuditCategory.EMAIL,
          level: AuditLevel.INFO,
          source: 'system',
        }).catch(() => {});
      }
    }
  }
}
