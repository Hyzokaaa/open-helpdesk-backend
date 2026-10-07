import { EventPublisher } from '../../../shared/domain/event-publisher';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Command } from '../../../shared/domain/command';
import { CreateComment } from '../../domain/services/comment-create';
import { ExtractMentions } from '../../domain/services/comment-extract-mentions';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';
import { WorkspaceRepository } from '../../../workspace/domain/repositories/workspace.repository';
import { UserRepository } from '../../../user/domain/repositories/user.repository';
import { NewCommentEvent } from '../../../email/domain/events';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { AddTicketParticipant } from '../../../ticket/domain/services/ticket-add-participant';
import { ParticipantRole } from '../../../ticket/domain/enums/participant-role.enum';
import { formatTicketNumber } from '../../../ticket/domain/ticket-number';
import { TicketReferenceFormats } from '../../../ticket/domain/services/ticket-reference-formats';
import { commentPreview } from '../../domain/comment-preview';

interface Props {
  content: string;
  ticketId: string;
  authorId: string;
  workspaceSlug: string;
  isSystemAdmin: boolean;
  /** Set when the action came through the public API, with the key that made it. */
  apiKeyId?: string;
}

export interface CreateCommentResponse {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
}

export class CreateCommentCommand implements Command<Props, CreateCommentResponse> {
  constructor(
    private readonly createComment: CreateComment,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ticketRepository: TicketRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: EventPublisher,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly addParticipant?: AddTicketParticipant,
    private readonly referenceFormats?: TicketReferenceFormats,
  ) {}

  async execute(props: Props): Promise<CreateCommentResponse> {
    const workspace = await this.workspaceRepository.findBySlug(props.workspaceSlug);
    if (!workspace) throw new EntityNotFoundError('Workspace not found');

    await this.ensureTicketAccess.ensureCanContribute({
      ticketId: props.ticketId,
      userId: props.authorId,
      workspaceId: workspace.getId(),
      isSystemAdmin: props.isSystemAdmin,
    });
    const ticket = await this.ticketRepository.findById(props.ticketId);
    if (!ticket) throw new EntityNotFoundError('Ticket not found');

    const extractMentions = new ExtractMentions();
    const mentionedUserIds = extractMentions.execute(props.content);

    const comment = await this.createComment.execute({
      content: props.content,
      ticketId: props.ticketId,
      authorId: props.authorId,
      mentionedUserIds,
    });

    const author = await this.userRepository.findById(props.authorId);

    if (ticket.firstResponseAt === null && props.authorId !== ticket.reporterId) {
      ticket.firstResponseAt = new Date();
      await this.ticketRepository.update(ticket);
    }

    if (author) {

      const event: NewCommentEvent = {
        ticketId: props.ticketId,
        ticketName: ticket.name,
        ticketNumber: this.referenceFormats
          ? await this.referenceFormats.format(ticket.workspaceId, ticket.ticketNumber)
          : formatTicketNumber(ticket.ticketNumber),
        commentId: comment.getId(),
        authorId: props.authorId,
        authorName: `${author.firstName} ${author.lastName}`,
        commentContent: props.content,
        assigneeId: ticket.assigneeId,
        mentionedUserIds,
        workspaceId: workspace.getId(),
        workspaceName: workspace.name,
        workspaceSlug: workspace.slug,
        mailboxId: ticket.mailboxId,
      };
      this.eventPublisher.emit('comment.created', event);

      if (this.addParticipant && mentionedUserIds.length > 0) {
        for (const userId of mentionedUserIds) {
          await this.addParticipant.execute({
            ticketId: props.ticketId,
            userId,
            role: ParticipantRole.FOLLOWER,
          });
        }
      }
    }

    await this.createAuditLog.execute({
      action: AuditAction.COMMENT_CREATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: props.apiKeyId ? 'api' : 'ui',
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.authorId,
      workspaceId: workspace.getId(),
      metadata: { ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}), ticketName: ticket.name, commentId: comment.getId(), content: commentPreview(props.content) },
    });

    return {
      id: comment.getId(),
      content: comment.content,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
    };
  }
}
