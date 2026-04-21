import { Query } from '../../../shared/domain/query';
import { S3StorageService } from '../../../shared/infrastructure/s3-storage.service';
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
    private readonly storage: S3StorageService,
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
