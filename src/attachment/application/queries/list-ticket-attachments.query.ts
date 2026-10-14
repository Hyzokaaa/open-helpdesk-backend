import { Query } from '../../../shared/domain/query';
import { StorageService } from '../../../shared/domain/storage-service';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';
import { AttachmentRepository } from '../../domain/repositories/attachment.repository';
import { AttachmentDeleter, canDeleteAttachment } from '../../domain/services/attachment-ensure-access';
import { SummarizeUsers, UserSummary } from '../../../user/domain/services/user-summarize';

interface Props {
  ticketId: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface AttachmentListItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
  /** Whether the caller may delete it, so the client follows the server's rule instead of repeating it. */
  canDelete: boolean;
  /** The comment it was attached to, or null when it belongs to the ticket itself. */
  commentId: string | null;
  createdAt: Date | null;
  uploadedBy: UserSummary | null;
}

export class ListTicketAttachmentsQuery implements Query<Props, AttachmentListItem[]> {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly storage: StorageService,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly summarizeUsers: SummarizeUsers,
  ) {}

  async execute(props: Props): Promise<AttachmentListItem[]> {
    await this.ensureTicketAccess.execute(props);
    const ctx = props.isSystemAdmin
      ? null
      : await this.ensurePermission.execute({ workspaceId: props.workspaceId, userId: props.userId });
    const deleter: AttachmentDeleter = {
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
      role: ctx?.role ?? null,
    };

    const attachments = await this.repository.findByTicketId(props.ticketId);
    const uploaders = await this.summarizeUsers.execute(attachments.map((a) => a.uploadedById));
    return Promise.all(
      attachments.map(async (a) => ({
        id: a.getId(),
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
        downloadUrl: await this.storage.getPresignedUrl(a.s3Key),
        canDelete: canDeleteAttachment(a, deleter),
        commentId: a.commentId,
        createdAt: a.createdAt,
        uploadedBy: (a.uploadedById && uploaders.get(a.uploadedById)) || null,
      })),
    );
  }
}
