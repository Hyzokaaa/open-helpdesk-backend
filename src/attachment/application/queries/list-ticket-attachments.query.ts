import { Query } from '../../../shared/domain/query';
import { StorageService } from '../../../shared/domain/storage-service';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { EnsureTicketAccess } from '../../../ticket/domain/services/ticket-ensure-access';
import { AttachmentRepository } from '../../domain/repositories/attachment.repository';
import { AttachmentDeleter, canDeleteAttachment } from '../../domain/services/attachment-ensure-access';

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
}

export class ListTicketAttachmentsQuery implements Query<Props, AttachmentListItem[]> {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly storage: StorageService,
    private readonly ensureTicketAccess: EnsureTicketAccess,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<AttachmentListItem[]> {
    const ticketAccess = await this.ensureTicketAccess.execute(props);
    const ctx = props.isSystemAdmin
      ? null
      : await this.ensurePermission.execute({ workspaceId: props.workspaceId, userId: props.userId });
    const deleter: AttachmentDeleter = {
      userId: props.userId,
      isSystemAdmin: props.isSystemAdmin,
      ticketAccess,
      role: ctx?.role ?? null,
    };

    const attachments = await this.repository.findByTicketId(props.ticketId);
    return Promise.all(
      attachments.map(async (a) => ({
        id: a.getId(),
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
        downloadUrl: await this.storage.getPresignedUrl(a.s3Key),
        canDelete: canDeleteAttachment(a, deleter),
      })),
    );
  }
}
