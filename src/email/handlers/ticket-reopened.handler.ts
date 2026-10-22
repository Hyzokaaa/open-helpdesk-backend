import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EmailService } from '../domain/email.service';
import { EMAIL_SERVICE } from '../email.constants';
import { TicketReopenedTemplate } from '../templates/ticket-reopened.template';
import { TicketReopenedEvent } from '../domain/events';
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
import { ResolveTicketStakeholders } from '../../notification/domain/services/notification-resolve-ticket-stakeholders';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';
import { WorkspaceFrontendResolver } from '../../shared/infrastructure/workspace-frontend-resolver';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { WorkspaceRole } from '../../workspace/domain/enums/workspace-role.enum';
import { ticketThreadHeaders } from '../domain/ticket-email-thread';
import { eachEmailRecipient } from '../domain/each-email-recipient';
import { RecordEmailSend } from '../../audit-log/domain/services/audit-log-record-email-send';
import { ResolveTicketReplyMailbox } from '../domain/services/ticket-reply-mailbox-resolve';
import { ResolveTicketEmailLink } from '../domain/ticket-email-link';
import { TypeOrmWorkspaceRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { EnsureTicketPortalAccess } from '../../ticket/domain/services/ticket-portal-access-ensure';
import { TypeOrmTicketPortalAccessRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket-portal-access.repository';
import { User } from '../../user/domain/entities/user';

const fullName = (u: User) => `${u.firstName} ${u.lastName}`.trim() || u.email;

/**
 * Tells the people of a reopened ticket, under the status-change preferences: the team (whoever
 * has it, who had resolved it, the followers) with the reason and the note; the requester only
 * that it is being worked on again. Whoever reopened it is not told.
 */
@Injectable()
export class TicketReopenedHandler {
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
    private readonly portalAccessRepository: TypeOrmTicketPortalAccessRepository,
    private readonly workspaceRepository: TypeOrmWorkspaceRepository,
  ) {}

  @OnEvent('ticket.reopened')
  async handle(event: TicketReopenedEvent): Promise<void> {
    const ticket = await this.ticketRepository.findById(event.ticketId);
    if (!ticket || ticket.workspaceId !== event.workspaceId) return;

    const stakeholders = await new ResolveTicketStakeholders(this.ticketRepository, this.participantRepository, this.userRepository)
      .execute({ ticketId: event.ticketId, excludeUserId: event.reopenedById });
    const extra = event.previousResolvedById && event.previousResolvedById !== event.reopenedById
      && !stakeholders.some((u) => u.getId() === event.previousResolvedById)
      ? await this.userRepository.findByIds([event.previousResolvedById])
      : [];
    const users = [...stakeholders, ...extra];
    if (users.length === 0) return;

    // The requester (and customers following it) never see the team's note
    const isTeam = async (u: User) => {
      if (u.getId() === ticket.reporterId) return false;
      const member = await this.memberRepository.findByWorkspaceAndUser(event.workspaceId, u.getId());
      return member ? member.role !== WorkspaceRole.USER : u.isSystemAdmin;
    };
    const team: User[] = [];
    const customers: User[] = [];
    for (const u of users) (await isTeam(u) ? team : customers).push(u);

    const [actor] = await this.userRepository.findByIds([event.reopenedById]);
    const [resolver] = event.previousResolvedById ? await this.userRepository.findByIds([event.previousResolvedById]) : [];
    const reopenedBy = actor ? fullName(actor) : '';

    await this.notify(event, team, `↺ ${event.ticketName}`, {
      reason: event.reason, note: event.note, previousResolver: resolver ? fullName(resolver) : null,
    }, reopenedBy);
    await this.notify(event, customers, `↺ ${event.ticketName}`, undefined, reopenedBy);
  }

  private async notify(
    event: TicketReopenedEvent,
    users: User[],
    title: string,
    team: { reason: string; note: string; previousResolver: string | null } | undefined,
    reopenedBy: string,
  ): Promise<void> {
    if (users.length === 0) return;
    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.STATUS_CHANGED,
      title,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppStatusChanged',
      emailPrefKey: 'emailStatusChanged',
    });
    if (emailRecipients.size === 0) return;

    const template = new TicketReopenedTemplate();
    const frontendUrl = await this.frontendResolver.resolve(event.workspaceId);
    const ticket = await this.ticketRepository.findById(event.ticketId);
    const mailbox = await new ResolveTicketReplyMailbox(this.mailboxRepository).execute({
      ticketMailboxId: ticket?.mailboxId,
      workspaceId: event.workspaceId,
    });
    const emailDomain = mailbox ? mailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);
    const usersByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    const resolveLink = new ResolveTicketEmailLink(new EnsureTicketPortalAccess(this.idGenerator, this.portalAccessRepository));
    const workspace = await this.workspaceRepository.findById(event.workspaceId);

    for (const [lang, emails] of eachEmailRecipient(emailRecipients)) {
      const recipient = usersByEmail.get(emails[0].toLowerCase());
      const member = recipient ? await this.memberRepository.findByWorkspaceAndUser(event.workspaceId, recipient.getId()) : null;
      const ticketUrl = await resolveLink.execute({
        frontendUrl,
        workspaceSlug: event.workspaceSlug,
        ticketId: event.ticketId,
        userId: recipient?.getId() ?? null,
        role: member?.role ?? null,
        isSystemAdmin: recipient?.isSystemAdmin ?? false,
        portalEnabled: workspace?.portalEnabled ?? true,
        autoCreated: recipient?.autoCreated ?? false,
      });
      const data = { ticketName: event.ticketName, ticketUrl, workspaceName: event.workspaceName, reopenedBy, team, canReply: !!mailbox, lang };
      const subject = template.subject(data);
      const result = await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject,
        html: template.html(data),
        ...(emailDomain && ticketThreadHeaders(event.ticketId, emailDomain, `reopen-${event.ticketId}-${Date.now()}`)),
        ...(mailbox && { replyTo: mailbox.address }),
      });
      await new RecordEmailSend(this.idGenerator, this.auditLogRepository).execute({
        result, type: 'ticket-reopened', to: emails, subject, workspaceId: event.workspaceId, ticketId: event.ticketId, ticketName: event.ticketName,
      });
    }
  }
}
