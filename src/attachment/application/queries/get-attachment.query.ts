import { Query } from '../../../shared/domain/query';
import { StorageService } from '../../../shared/domain/storage-service';
import { EnsureAttachmentAccess } from '../../domain/services/attachment-ensure-access';

interface Props {
  attachmentId: string;
  userId: string;
  isSystemAdmin: boolean;
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
    private readonly ensureAttachmentAccess: EnsureAttachmentAccess,
    private readonly storage: StorageService,
  ) {}

  async execute(props: Props): Promise<AttachmentResponse> {
    const { attachment } = await this.ensureAttachmentAccess.execute(props);
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
