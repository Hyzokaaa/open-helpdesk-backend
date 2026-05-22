import { randomBytes } from 'crypto';
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
import { TicketPriority } from '../../../ticket/domain/enums/ticket-priority.enum';
import { TicketCategory } from '../../../ticket/domain/enums/ticket-category.enum';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { TicketCreatedEvent, NewCommentEvent } from '../../../email/domain/events';
import { ParsedInboundEmail } from './parse-inbound-email';

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
  ) {}

  async execute(parsed: ParsedInboundEmail): Promise<RouteInboundEmailResult> {
    // 1. Find mailbox
    let mailbox = null;
    for (const addr of parsed.toAddresses) {
      mailbox = await this.mailboxRepository.findByAddress(addr);
      if (mailbox && mailbox.isActive) break;
      mailbox = null;
    }

    if (!mailbox) {
      this.logger.warn(`No active mailbox found for addresses: ${parsed.toAddresses.join(', ')}`);
      return { action: 'rejected', reason: 'unknown-mailbox' };
    }

    // 2. Find or create user
    let user = await this.userRepository.findByEmail(parsed.fromAddress);
    if (!user) {
      const localPart = parsed.fromAddress.split('@')[0];
      user = await this.createUser.execute({
        email: parsed.fromAddress,
        password: randomBytes(32).toString('hex'),
        firstName: localPart,
        lastName: '',
        isEmailVerified: true,
        autoCreated: true,
      });
      this.logger.log(`Auto-created reporter: ${parsed.fromAddress}`);
    }

    // 3. Ensure workspace membership
    const existingMember = await this.memberRepository.findByWorkspaceAndUser(
      mailbox.workspaceId,
      user.getId(),
    );
    if (!existingMember) {
      await this.addMember.execute({
        workspaceId: mailbox.workspaceId,
        userId: user.getId(),
        role: WorkspaceRole.REPORTER,
      });
      this.logger.log(`Added ${parsed.fromAddress} as REPORTER to workspace ${mailbox.workspaceId}`);
    }

    // 4. Route: reply to existing ticket or create new
    if (parsed.inReplyToTicketId) {
      const ticket = await this.ticketRepository.findById(parsed.inReplyToTicketId);
      if (ticket && ticket.workspaceId === mailbox.workspaceId) {
        const comment = await this.createComment.execute({
          content: parsed.body,
          ticketId: ticket.getId(),
          authorId: user.getId(),
        });

        const workspace = await this.workspaceRepository.findById(mailbox.workspaceId);
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
          };
          this.eventPublisher.emit('comment.created', event);
        }

        return { action: 'comment-added', ticketId: ticket.getId() };
      }
    }

    // 5. Create new ticket
    const workspace = await this.workspaceRepository.findById(mailbox.workspaceId);
    if (!workspace) {
      return { action: 'rejected', reason: 'workspace-not-found' };
    }

    const ticket = await this.createTicket.execute({
      name: parsed.subject,
      description: parsed.body,
      priority: TicketPriority.MEDIUM,
      category: TicketCategory.ISSUE,
      workspaceId: mailbox.workspaceId,
      creatorId: user.getId(),
      tagIds: [],
    });

    const ticketEvent: TicketCreatedEvent = {
      ticketId: ticket.getId(),
      ticketName: ticket.name,
      priority: ticket.priority,
      category: ticket.category,
      creatorId: user.getId(),
      creatorName: `${user.firstName} ${user.lastName}`.trim(),
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
    };
    this.eventPublisher.emit('ticket.created', ticketEvent);

    return { action: 'ticket-created', ticketId: ticket.getId() };
  }
}
