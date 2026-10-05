import { Command } from '../../../shared/domain/command';
import { EntityNotFoundError } from '../../../shared/domain/errors';
import { PERMISSIONS } from '../../../workspace/domain/permissions';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';
import { CommentRepository } from '../../../comment/domain/repositories/comment.repository';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { CreateAttachment } from '../../domain/services/attachment-create';

interface Props {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  ticketId: string;
  /** When set, the file belongs to this comment of the ticket. */
  commentId: string | null;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface UploadAttachmentResponse {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export class UploadAttachmentCommand implements Command<Props, UploadAttachmentResponse> {
  constructor(
    private readonly createAttachment: CreateAttachment,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly commentRepository: CommentRepository,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<UploadAttachmentResponse> {
    await this.ensureTicketAccess.ensureCanContribute({
      ticketId: props.ticketId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      isSystemAdmin: props.isSystemAdmin,
    });
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.ATTACHMENT_UPLOAD,
      isSystemAdmin: props.isSystemAdmin,
    });

    if (props.commentId) {
      const comment = await this.commentRepository.findById(props.commentId);
      if (!comment || comment.ticketId !== props.ticketId) {
        throw new EntityNotFoundError('Comment not found');
      }
    }

    // The ticket is recorded for a comment's file too, so it shows among the ticket's attachments.
    const attachment = await this.createAttachment.execute({
      buffer: props.buffer,
      originalName: props.originalName,
      mimeType: props.mimeType,
      size: props.size,
      ticketId: props.ticketId,
      commentId: props.commentId,
      uploadedById: props.userId,
    });

    await this.createAuditLog.execute({
      action: AuditAction.ATTACHMENT_UPLOADED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: 'attachment',
      entityId: attachment.getId(),
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: {
        ticketId: props.ticketId,
        commentId: props.commentId,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      },
    });

    return {
      id: attachment.getId(),
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }
}
