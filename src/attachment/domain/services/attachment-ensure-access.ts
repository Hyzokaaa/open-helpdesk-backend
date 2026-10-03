import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';
import { CommentRepository } from '../../../comment/domain/repositories/comment.repository';
import { Attachment } from '../entities/attachment';
import { AttachmentRepository } from '../repositories/attachment.repository';

interface Props {
  attachmentId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface AttachmentAccess {
  attachment: Attachment;
  /** Null for an upload staged for a ticket that does not exist yet. */
  workspaceId: string | null;
}

/** Someone who can already see the attachment's ticket. */
export interface AttachmentDeleter {
  userId: string;
  isSystemAdmin: boolean;
  role: WorkspaceRole | null;
}

/**
 * Everyone who sees the ticket may delete the attachments they added, followers included; admins
 * and supervisors may also delete anyone else's, for files that must not stay (personal data,
 * malware). Editing what someone else said is never allowed; removing a file is moderation.
 */
export function canDeleteAttachment(attachment: Attachment, deleter: AttachmentDeleter): boolean {
  if (deleter.isSystemAdmin) return true;
  if (!deleter.role) return false;
  if (!hasPermission(deleter.role, PERMISSIONS.ATTACHMENT_DELETE)) return false;
  return attachment.uploadedById === deleter.userId
    || hasPermission(deleter.role, PERMISSIONS.ATTACHMENT_DELETE_ANY);
}

/** An attachment is part of its ticket: whoever can see the ticket can see its attachments. */
export class EnsureAttachmentAccess {
  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    private readonly ticketRepository: TicketRepository,
    private readonly commentRepository: CommentRepository,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  /** Anything the caller may not see is reported as not found, so its existence does not leak. */
  async execute(props: Props): Promise<AttachmentAccess> {
    const attachment = await this.attachmentRepository.findById(props.attachmentId);
    if (!attachment) throw new EntityNotFoundError('Attachment not found');

    const ticketId = attachment.ticketId ?? await this.ticketIdOfComment(attachment.commentId);
    if (!ticketId) {
      if (attachment.uploadedById !== props.userId && !props.isSystemAdmin) {
        throw new EntityNotFoundError('Attachment not found');
      }
      return { attachment, workspaceId: null };
    }

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new EntityNotFoundError('Attachment not found');

    try {
      await this.ensureTicketAccess.execute({
        ticketId,
        userId: props.userId,
        workspaceId: ticket.workspaceId,
        isSystemAdmin: props.isSystemAdmin,
      });
    } catch (error) {
      if (error instanceof AccessDeniedError || error instanceof EntityNotFoundError) {
        throw new EntityNotFoundError('Attachment not found');
      }
      throw error;
    }
    return { attachment, workspaceId: ticket.workspaceId };
  }

  async ensureCanDelete(props: Props): Promise<AttachmentAccess> {
    const access = await this.execute(props);
    if (!access.workspaceId) return access;

    const ctx = props.isSystemAdmin
      ? null
      : await this.ensurePermission.execute({ workspaceId: access.workspaceId, userId: props.userId });
    const deleter: AttachmentDeleter = {
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
      role: ctx?.role ?? null,
    };
    if (!canDeleteAttachment(access.attachment, deleter)) {
      throw new AccessDeniedError('You cannot delete this attachment');
    }
    return access;
  }

  private async ticketIdOfComment(commentId: string | null): Promise<string | null> {
    if (!commentId) return null;
    const comment = await this.commentRepository.findById(commentId);
    return comment?.ticketId ?? null;
  }
}
