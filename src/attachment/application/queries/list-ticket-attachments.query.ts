import { Query } from '../../../shared/domain/query';
import { StorageService } from '../../../shared/domain/storage-service';
import { AttachmentRepository } from '../../domain/repositories/attachment.repository';

interface Props {
  ticketId: string;
}

export interface AttachmentListItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
}

export class ListTicketAttachmentsQuery implements Query<Props, AttachmentListItem[]> {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly storage: StorageService,
  ) {}

  async execute(props: Props): Promise<AttachmentListItem[]> {
    const attachments = await this.repository.findByTicketId(props.ticketId);
    return Promise.all(
      attachments.map(async (a) => ({
        id: a.getId(),
        originalName: a.originalName,
        mimeType: a.mimeType,
        size: a.size,
        downloadUrl: await this.storage.getPresignedUrl(a.s3Key),
      })),
    );
  }
}
