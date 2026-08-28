import { randomBytes, randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { MailboxRepository } from '../../../mailbox/domain/repositories/mailbox.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { WorkspaceMemberRepository } from '../../../workspace/domain/repositories/workspace-member.repository';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { CreateUser } from '../../../user/domain/services/user-create';
import { AddWorkspaceMember } from '../../../workspace/domain/services/workspace-add-member';
import { CreateTicket } from '../../../ticket/domain/services/ticket-create';
import { CreateComment } from '../../../comment/domain/services/comment-create';
import { CreateAttachment } from '../../../attachment/domain/services/attachment-create';
import { TicketPriority } from '../../../ticket/domain/enums/ticket-priority.enum';
import { TicketSource } from '../../../ticket/domain/enums/ticket-source.enum';
import { TicketCategoryRepository } from '../../../project/domain/repositories/ticket-category.repository';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { TicketCreatedEvent, NewCommentEvent } from '../../../email/domain/events';
import { ParsedInboundEmail } from '../../infrastructure/imap/imap-email-parser';
import { EvaluateEmailRules } from '../../../email-rule/domain/services/email-rule-evaluate';
import { OrganizationRepository } from '../../../organization/domain/repositories/organization.repository';
import { AutoEnrollOrganization } from '../../../organization/domain/services/organization-auto-enroll';

export interface RouteInboundEmailResult {
  action: 'ticket-created' | 'comment-added' | 'rejected';
  ticketId?: string;
  reason?: string;
}

export class RouteInboundEmail {
  private readonly logger = new Logger(RouteInboundEmail.name);

  constructor(
    private readonly mailboxRepository: MailboxRepository,
    private readonly userRepository: UserRepository,
    private readonly memberRepository: WorkspaceMemberRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly createUser: CreateUser,
    private readonly addMember: AddWorkspaceMember,
    private readonly createTicket: CreateTicket,
    private readonly createComment: CreateComment,
    private readonly eventPublisher: EventPublisher,
    private readonly createAttachment?: CreateAttachment,
    private readonly evaluateRules?: EvaluateEmailRules,
    private readonly organizationRepository?: OrganizationRepository,
    private readonly ticketCategoryRepository?: TicketCategoryRepository,
  ) {}

  async execute(parsed: ParsedInboundEmail): Promise<RouteInboundEmailResult> {
    // 1. Find mailbox — try the poller's mailbox first, then search by To/CC addresses
    let mailbox = null;
    let viaSystemMailbox = false;
    if (parsed.mailboxId) {
      const pollerMailbox = await this.mailboxRepository.findById(parsed.mailboxId);
      if (pollerMailbox?.isActive) {
        if (pollerMailbox.addressMode === 'all' && pollerMailbox.workspaceId) {
          // Workspace mailbox in catch-all mode: accept any email
          mailbox = pollerMailbox;
        } else if (pollerMailbox.workspaceId === null) {
          // System/platform mailbox: always delegate to TO-based lookup
          viaSystemMailbox = true;
        } else {
          // Check if the email was actually sent TO this mailbox's address
          const recipients = parsed.toAddresses.map(a => a.toLowerCase());
          if (recipients.includes(pollerMailbox.address.toLowerCase())) {
            mailbox = pollerMailbox;
          }
        }
      }
    }

    // If poller's mailbox didn't match (catch-all scenario), search by To/CC addresses
    if (!mailbox) {
      for (const addr of parsed.toAddresses) {
        const found = await this.mailboxRepository.findByAddress(addr);
        if (found && found.isActive) {
          mailbox = found;
          break;
        }
      }
    }

    if (!mailbox) {
      this.logger.warn(`No active mailbox found for addresses: ${parsed.toAddresses.join(', ')}`);
      return { action: 'rejected', reason: 'unknown-mailbox' };
    }

    // If routed via platform catch-all, check if workspace allows it
    if (viaSystemMailbox && mailbox.workspaceId) {
      const ws = await this.workspaceRepository.findById(mailbox.workspaceId);
      if (ws && !ws.systemMailboxEnabled) {
        this.logger.log(`Workspace ${mailbox.workspaceId} has system mailbox disabled — rejecting`);
        return { action: 'rejected', reason: 'system-mailbox-disabled' };
      }
    }

    if (!mailbox.workspaceId) {
      this.logger.warn(`System mailbox ${mailbox.getId()} has no workspace — skipping routing`);
      return { action: 'rejected', reason: 'system-mailbox-no-workspace' };
    }

    const workspaceId = mailbox.workspaceId;

    // 2. Evaluate email rules (before creating user/member)
    let ruleResult = { action: 'proceed' as const } as import('../../../email-rule/domain/services/email-rule-evaluate').EmailRuleResult;
    if (this.evaluateRules) {
      ruleResult = await this.evaluateRules.execute(
        { fromAddress: parsed.fromAddress, toAddresses: parsed.toAddresses, subject: parsed.subject },
        workspaceId,
        mailbox.getId(),
      );
      if (ruleResult.action === 'reject') {
        this.logger.log(`Email rejected by rule "${ruleResult.matchedRuleName}": ${parsed.fromAddress} — ${parsed.subject}`);
        return { action: 'rejected', reason: 'rule-rejected' };
      }
    }

    // 3. Find or create user (only if not rejected)
    let user = await this.userRepository.findByEmail(parsed.fromAddress);
    if (!user) {
      const { firstName, lastName } = this.extractNameFromEmail(parsed.fromName, parsed.fromAddress);
      user = await this.createUser.execute({
        email: parsed.fromAddress,
        password: randomBytes(32).toString('hex'),
        firstName,
        lastName,
        isEmailVerified: true,
        autoCreated: true,
      });
      this.logger.log(`Auto-created reporter: ${parsed.fromAddress} (${firstName} ${lastName})`);
    }

    // 3. Ensure workspace membership
    const existingMember = await this.memberRepository.findByWorkspaceAndUser(
      workspaceId,
      user.getId(),
    );
    if (!existingMember) {
      await this.addMember.execute({
        workspaceId: workspaceId,
        userId: user.getId(),
        role: WorkspaceRole.REPORTER,
      });
      this.logger.log(`Added ${parsed.fromAddress} as REPORTER to workspace ${workspaceId}`);
    }

    // 4. Route: reply to existing ticket or create new
    if (parsed.inReplyToTicketId) {
      const ticket = await this.ticketRepository.findById(parsed.inReplyToTicketId);
      if (ticket && ticket.workspaceId === workspaceId) {
        const comment = await this.createComment.execute({
          content: parsed.body,
          ticketId: ticket.getId(),
          authorId: user.getId(),
        });

        const workspace = await this.workspaceRepository.findById(workspaceId);
        if (workspace) {
          const event: NewCommentEvent = {
            ticketId: ticket.getId(),
            ticketName: ticket.name,
            commentId: comment.getId(),
            authorId: user.getId(),
            authorName: `${user.firstName} ${user.lastName}`.trim(),
            commentContent: parsed.body,
            assigneeId: ticket.assigneeId,
            mentionedUserIds: [],
            workspaceId: workspace.getId(),
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
            mailboxId: mailbox.getId(),
          };
          this.eventPublisher.emit('comment.created', event);
        }

        await this.uploadAttachments(parsed, ticket.getId(), comment.getId(), user.getId());
        return { action: 'comment-added', ticketId: ticket.getId() };
      }
    }

    // 5. Create new ticket
    const workspace = await this.workspaceRepository.findById(workspaceId);
    if (!workspace) {
      return { action: 'rejected', reason: 'workspace-not-found' };
    }

    // Resolve organization: email rule takes priority, fallback to auto-enroll by domain
    let organizationId: string | null = ruleResult.organizationId ?? null;
    if (!organizationId && this.organizationRepository) {
      const autoEnroll = new AutoEnrollOrganization(this.organizationRepository);
      const result = await autoEnroll.execute(parsed.fromAddress, workspaceId);
      organizationId = result.organizationId;
    }
    if (organizationId) {
      const member = await this.memberRepository.findByWorkspaceAndUser(workspaceId, user.getId());
      if (member && !member.organizationId) {
        member.organizationId = organizationId;
        await this.memberRepository.update(member);
      }
    }

    const ticket = await this.createTicket.execute({
      name: parsed.subject,
      description: parsed.body,
      priority: ruleResult.priority ?? TicketPriority.MEDIUM,
      categoryId: ruleResult.category ?? (this.ticketCategoryRepository ? (await this.ticketCategoryRepository.findBySlugAndWorkspace('issue', workspaceId))?.getId() ?? '' : ''),
      workspaceId: workspaceId,
      reporterId: user.getId(),
      tagIds: ruleResult.tagIds ?? [],
      source: TicketSource.EMAIL,
      portalToken: randomUUID(),
      mailboxId: mailbox.getId(),
      originDate: parsed.date ?? null,
      departmentId: ruleResult.departmentId ?? null,
      organizationId,
    });

    const ticketEvent: TicketCreatedEvent = {
      ticketId: ticket.getId(),
      ticketName: ticket.name,
      priority: ticket.priority,
      categoryId: ticket.categoryId,
      reporterId: user.getId(),
      reporterName: `${user.firstName} ${user.lastName}`.trim(),
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      portalToken: ticket.portalToken,
      source: 'email',
      mailboxId: mailbox.getId(),
    };
    if (ruleResult.assigneeId) {
      ticket.assigneeId = ruleResult.assigneeId;
      await this.ticketRepository.update(ticket);
    }

    this.eventPublisher.emit('ticket.created', ticketEvent);

    await this.uploadAttachments(parsed, ticket.getId(), null, user.getId());

    return { action: 'ticket-created', ticketId: ticket.getId() };
  }

  private extractNameFromEmail(
    displayName: string | undefined,
    email: string,
  ): { firstName: string; lastName: string } {
    if (displayName?.trim()) {
      let clean = displayName.trim();
      // Reject garbage names (Exchange internal addresses, encoded strings)
      if (clean.includes('+20') || clean.includes('_o=') || clean.includes('_ou=') || clean.length > 80) {
        return { firstName: email.split('@')[0].substring(0, 40), lastName: '' };
      }
      const parts = clean.split(/\s+/);
      const firstName = parts[0].substring(0, 40);
      const lastName = parts.slice(1).join(' ').substring(0, 40);
      return { firstName, lastName };
    }
    return { firstName: email.split('@')[0].substring(0, 40), lastName: '' };
  }

  private async uploadAttachments(
    parsed: ParsedInboundEmail,
    ticketId: string,
    commentId: string | null,
    userId: string,
  ): Promise<void> {
    if (!this.createAttachment || parsed.attachments.length === 0) return;

    for (const att of parsed.attachments) {
      try {
        await this.createAttachment.execute({
          buffer: att.content,
          originalName: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          ticketId,
          commentId,
          uploadedById: userId,
        });
        this.logger.log(`Attachment uploaded: ${att.filename} (${att.size} bytes)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`Failed to upload attachment ${att.filename}: ${msg}`);
      }
    }
  }
}
