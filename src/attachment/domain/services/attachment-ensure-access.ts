import { AccessDeniedError, EntityNotFoundError } from '../../../shared/domain/errors';
import { PERMISSIONS, hasPermission } from '../../../workspace/domain/permissions';
import { WorkspaceRole } from '../../../workspace/domain/enums/workspace-role.enum';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { TicketRepository } from '../../../ticket/domain/repositories/ticket.repository';
import { EnsureTicketAccess, TicketAccessLevel } from '../../../ticket/domain/services/ticket-ensure-access';
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

export interface AttachmentDeleter {
  userId: string;
  isSystemAdmin: boolean;
  ticketAccess: TicketAccessLevel;
  role: WorkspaceRole | null;
}

/**
 * Admins and supervisors may delete any attachment of a ticket they fully access; everyone else
 * only the attachments they added themselves.
 */
export function canDeleteAttachment(attachment: Attachment, deleter: AttachmentDeleter): boolean {
  if (deleter.isSystemAdmin) return true;
  if (deleter.ticketAccess !== 'full' || !deleter.role) return false;
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

  async execute(props: Props): Promise<AttachmentAccess> {
    const { access } = await this.locate(props);
    return access;
  }

  async ensureCanDelete(props: Props): Promise<AttachmentAccess> {
    const { access, ticketAccess } = await this.locate(props);
    if (!access.workspaceId || !ticketAccess) return access;

    const ctx = props.isSystemAdmin
      ? null
      : await this.ensurePermission.execute({ workspaceId: access.workspaceId, userId: props.userId });
    const deleter: AttachmentDeleter = {
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
      ticketAccess,
      role: ctx?.role ?? null,
    };
    if (!canDeleteAttachment(access.attachment, deleter)) {
      throw new AccessDeniedError('You cannot delete this attachment');
    }
    return access;
  }

  /** Anything the caller may not see is reported as not found, so its existence does not leak. */
  private async locate(props: Props): Promise<{ access: AttachmentAccess; ticketAccess: TicketAccessLevel | null }> {
    const attachment = await this.attachmentRepository.findById(props.attachmentId);
    if (!attachment) throw new EntityNotFoundError('Attachment not found');

    const ticketId = attachment.ticketId ?? await this.ticketIdOfComment(attachment.commentId);
    if (!ticketId) {
      if (attachment.uploadedById !== props.userId && !props.isSystemAdmin) {
        throw new EntityNotFoundError('Attachment not found');
      }
      return { access: { attachment, workspaceId: null }, ticketAccess: null };
    }

    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket) throw new EntityNotFoundError('Attachment not found');

    try {
      const ticketAccess = await this.ensureTicketAccess.execute({
        ticketId,
        userId: props.userId,
        workspaceId: ticket.workspaceId,
        isSystemAdmin: props.isSystemAdmin,
      });
      return { access: { attachment, workspaceId: ticket.workspaceId }, ticketAccess };
    } catch (error) {
      if (error instanceof AccessDeniedError || error instanceof EntityNotFoundError) {
        throw new EntityNotFoundError('Attachment not found');
      }
      throw error;
    }
  }

  private async ticketIdOfComment(commentId: string | null): Promise<string | null> {
    if (!commentId) return null;
    const comment = await this.commentRepository.findById(commentId);
    return comment?.ticketId ?? null;
  }
}
