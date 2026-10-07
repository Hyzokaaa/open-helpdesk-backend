import { Command } from '../../../shared/domain/command';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { DeleteAttachment } from '../../domain/services/attachment-delete';
import { EnsureAttachmentAccess } from '../../domain/services/attachment-ensure-access';

interface Props {
  attachmentId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteAttachmentCommand implements Command<Props, void> {
  constructor(
    private readonly deleteAttachment: DeleteAttachment,
    private readonly ensureAttachmentAccess: EnsureAttachmentAccess,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<void> {
    const { attachment, workspaceId } = await this.ensureAttachmentAccess.ensureCanDelete(props);

    await this.deleteAttachment.execute({ attachmentId: props.attachmentId });

    await this.createAuditLog.execute({
      action: AuditAction.ATTACHMENT_DELETED,
      category: AuditCategory.TICKET,
      level: AuditLevel.INFO,
      source: 'ui',
      entityType: attachment.ticketId ? 'ticket' : 'attachment',
      entityId: attachment.ticketId ?? props.attachmentId,
      userId: props.userId,
      workspaceId,
      metadata: {
        attachmentId: props.attachmentId,
        ticketId: attachment.ticketId,
        commentId: attachment.commentId,
        originalName: attachment.originalName,
        uploadedById: attachment.uploadedById,
      },
    });
  }
}
