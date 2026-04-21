import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Query } from '../../../shared/domain/query';
import { S3StorageService } from '../../../shared/infrastructure/s3-storage.service';
import { AttachmentRepository } from '../../domain/repositories/attachment.repository';

interface Props {
  attachmentId: string;
}

export interface AttachmentResponse {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  downloadUrl: string;
}

export class GetAttachmentQuery implements Query<Props, AttachmentResponse> {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly storage: S3StorageService,
  ) {}

  async execute(props: Props): Promise<AttachmentResponse> {
    const attachment = await this.repository.findById(props.attachmentId);
    if (!attachment) {
      throw new EntityNotFoundError('Attachment not found');
    }

    const downloadUrl = await this.storage.getPresignedUrl(attachment.s3Key);

    return {
      id: attachment.getId(),
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      downloadUrl,
    };
  }
}
