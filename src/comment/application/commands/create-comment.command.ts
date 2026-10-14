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
import { FollowTicket } from '../../../ticket/domain/services/ticket-follow';
import { ticketReferenceOf } from '../../../ticket/domain/ticket-reference';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { ClaimStagedAttachments } from '../../../attachment/domain/services/attachment-claim-staged';
import { commentPreview } from '../../domain/comment-preview';

interface Props {
  content: string;
  ticketId: string;
  authorId: string;
  workspaceSlug: string;
  isSystemAdmin: boolean;
  /** Set when the action came through the public API, with the key that made it. */
  apiKeyId?: string;
  /** Files uploaded beforehand (POST /uploads) that belong to this comment. */
  uploadTokens?: string[];
}

/** What a comment needs to take files uploaded beforehand. */
export interface CommentAttachments {
  ensurePermission: EnsureWorkspacePermission;
  claim: ClaimStagedAttachments;
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
    private readonly followTicket?: FollowTicket,
    private readonly attachments?: CommentAttachments,
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

    const uploadTokens = props.uploadTokens ?? [];
    if (uploadTokens.length > 0) {
      // Checked before the comment exists, so a refused upload leaves no comment behind
      if (!this.attachments) throw new Error('This comment cannot take attachments');
      await this.attachments.ensurePermission.execute({
        workspaceId: workspace.getId(),
        userId: props.authorId,
        permission: PERMISSIONS.ATTACHMENT_UPLOAD,
        isSystemAdmin: props.isSystemAdmin,
      });
    }

    const extractMentions = new ExtractMentions();
    const mentionedUserIds = extractMentions.execute(props.content);

    const comment = await this.createComment.execute({
      content: props.content,
      ticketId: props.ticketId,
      authorId: props.authorId,
      mentionedUserIds,
    });

    if (uploadTokens.length > 0 && this.attachments) {
      await this.attachments.claim.execute({
        tokens: uploadTokens,
        ticketId: props.ticketId,
        uploadedById: props.authorId,
        commentId: comment.getId(),
      });
    }

    // Whoever joins the conversation follows it, so the answer to their comment reaches them
    // even when the ticket is not assigned to them
    const source = props.apiKeyId ? 'api' : 'ui';
    if (this.followTicket && props.authorId !== ticket.reporterId && props.authorId !== ticket.assigneeId) {
      await this.followTicket.execute({ ticketId: props.ticketId, workspaceId: workspace.getId(), userId: props.authorId, actorId: props.authorId, reason: 'comment', source });
    }

    const author = await this.userRepository.findById(props.authorId);

    if (ticket.firstResponseAt === null && props.authorId !== ticket.reporterId) {
      ticket.firstResponseAt = new Date();
      await this.ticketRepository.update(ticket);
    }

    if (author) {

      const event: NewCommentEvent = {
        ticketId: props.ticketId,
        ticketName: ticket.name,
        ticketNumber: ticketReferenceOf(ticket),
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

      if (this.followTicket && mentionedUserIds.length > 0) {
        for (const userId of mentionedUserIds) {
          await this.followTicket.execute({ ticketId: props.ticketId, workspaceId: workspace.getId(), userId, actorId: props.authorId, reason: 'mention', source });
        }
      }
    }

    await this.createAuditLog.execute({
      action: AuditAction.COMMENT_CREATED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source,
      entityType: 'ticket',
      entityId: props.ticketId,
      userId: props.authorId,
      workspaceId: workspace.getId(),
      metadata: { ...(props.apiKeyId ? { apiKeyId: props.apiKeyId } : {}), ticketName: ticket.name, commentId: comment.getId(), content: commentPreview(props.content), ...(uploadTokens.length > 0 ? { attachmentsClaimed: uploadTokens.length } : {}) },
    });

    return {
      id: comment.getId(),
      content: comment.content,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
    };
  }
}
