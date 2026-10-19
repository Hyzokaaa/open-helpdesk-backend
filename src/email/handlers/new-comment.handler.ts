import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
import { TypeOrmAuditLogRepository } from '../../audit-log/infrastructure/typeorm/repositories/typeorm-audit-log.repository';
import { ResolveTicketStakeholders } from '../../notification/domain/services/notification-resolve-ticket-stakeholders';
import { ResolveUnattendedReplyRecipients } from '../../notification/domain/services/notification-resolve-unattended-reply';
import { DispatchNotifications } from '../../notification/domain/services/notification-dispatch';
import { NotificationType } from '../../notification/domain/enums/notification-type.enum';
import { WorkspaceFrontendResolver } from '../../shared/infrastructure/workspace-frontend-resolver';
import { ticketThreadHeaders } from '../domain/ticket-email-thread';
import { eachEmailRecipient } from '../domain/each-email-recipient';
import { TypeOrmWorkspaceMemberRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace-member.repository';
import { TypeOrmAttachmentRepository } from '../../attachment/infrastructure/typeorm/repositories/typeorm-attachment.repository';
import { ResolveTicketReplyMailbox } from '../domain/services/ticket-reply-mailbox-resolve';
import { ResolveTicketEmailLink } from '../domain/ticket-email-link';
import { TypeOrmWorkspaceRepository } from '../../workspace/infrastructure/typeorm/repositories/typeorm-workspace.repository';
import { EnsureTicketPortalAccess } from '../../ticket/domain/services/ticket-portal-access-ensure';
import { TypeOrmTicketPortalAccessRepository } from '../../ticket/infrastructure/typeorm/repositories/typeorm-ticket-portal-access.repository';
import { RecordEmailSend } from '../../audit-log/domain/services/audit-log-record-email-send';
import { User } from '../../user/domain/entities/user';

@Injectable()
export class NewCommentHandler {
  private readonly logger = new Logger(NewCommentHandler.name);

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
    private readonly attachmentRepository: TypeOrmAttachmentRepository,
    private readonly workspaceRepository: TypeOrmWorkspaceRepository,
  ) {}

  @OnEvent('comment.created')
  async handle(event: NewCommentEvent): Promise<void> {
    const notified = await this.notifyStakeholders(event);
    await this.alertUnattendedReply(event, notified);
  }

  /** The people of the ticket, plus anyone mentioned. Returns who was told. */
  private async notifyStakeholders(event: NewCommentEvent): Promise<Set<string>> {
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
    if (users.length === 0) return new Set();

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.COMMENT_CREATED,
      title: `${event.authorName} on ${event.ticketName}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppCommentCreated',
      emailPrefKey: 'emailCommentCreated',
    });
    await this.sendEmails(event, users, emailRecipients, false);
    return new Set(users.map((u) => u.getId()));
  }

  /**
   * A customer answered a ticket that no one on the team owns or follows: the admins and
   * supervisors hear of it, so the answer does not wait unseen (see ResolveUnattendedReplyRecipients).
   */
  private async alertUnattendedReply(event: NewCommentEvent, alreadyNotified: Set<string>): Promise<void> {
    const resolve = new ResolveUnattendedReplyRecipients(this.ticketRepository, this.participantRepository, this.memberRepository, this.userRepository);
    const users = (await resolve.execute({ ticketId: event.ticketId, workspaceId: event.workspaceId, authorId: event.authorId }))
      .filter((u) => !alreadyNotified.has(u.getId()));
    if (users.length === 0) return;

    const dispatch = new DispatchNotifications(this.idGenerator, this.notificationRepository, this.preferenceRepository);
    const { emailRecipients } = await dispatch.execute({
      users,
      type: NotificationType.UNATTENDED_REPLY,
      title: `${event.authorName} on ${event.ticketName}`,
      ticketId: event.ticketId,
      workspaceSlug: event.workspaceSlug,
      inAppPrefKey: 'inAppUnattendedReply',
      emailPrefKey: 'emailUnattendedReply',
    });
    await this.sendEmails(event, users, emailRecipients, true);
  }

  private async sendEmails(event: NewCommentEvent, users: User[], emailRecipients: Map<string, string[]>, unattended: boolean): Promise<void> {
    if (emailRecipients.size === 0) return;

    const template = new NewCommentTemplate();
    const ticket = await this.ticketRepository.findById(event.ticketId);
    const frontendUrl = await this.frontendResolver.resolve(event.workspaceId);
    // The ticket's own mailbox, or one the workspace reads, so a reply by email reaches the ticket
    const replyMailbox = await new ResolveTicketReplyMailbox(this.mailboxRepository).execute({
      ticketMailboxId: ticket?.mailboxId ?? event.mailboxId,
      workspaceId: event.workspaceId,
    });
    const emailDomain = replyMailbox ? replyMailbox.address.split('@')[1] : null;
    const sender = await this.emailSenderRepository.findByWorkspaceId(event.workspaceId);
    const files = (await this.attachmentRepository.findByCommentId(event.commentId)).map((a) => ({ name: a.originalName, size: a.size }));
    const usersByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    const resolveLink = new ResolveTicketEmailLink(new EnsureTicketPortalAccess(this.idGenerator, this.portalAccessRepository));
    const workspace = await this.workspaceRepository.findById(event.workspaceId);

    for (const [lang, emails] of eachEmailRecipient(emailRecipients)) {
      // Each recipient gets the link they can open: the portal for customers, the dashboard for the team
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
      const data = {
        ticketName: event.ticketName,
        ticketNumber: event.ticketNumber,
        ticketUrl,
        authorName: event.authorName,
        commentContent: event.commentContent,
        files,
        canReply: !!replyMailbox,
        unattended,
        workspaceName: event.workspaceName,
        lang,
      };
      const subject = template.subject(data);
      const result = await sendWorkspaceEmail(this.emailService, sender, {
        to: emails,
        subject,
        html: template.html(data),
        ...(emailDomain && ticketThreadHeaders(event.ticketId, emailDomain, `comment-${event.commentId}`)),
        ...(replyMailbox && { replyTo: replyMailbox.address }),
      });
      await new RecordEmailSend(this.idGenerator, this.auditLogRepository).execute({
        result, type: unattended ? 'unattended-reply' : 'comment-notification', to: emails, subject, workspaceId: event.workspaceId, ticketId: event.ticketId, ticketName: event.ticketName, ticketReference: event.ticketNumber,
      });
    }
  }
}
