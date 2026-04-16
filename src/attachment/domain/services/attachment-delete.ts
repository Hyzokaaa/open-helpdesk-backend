import { NotFoundException } from '@nestjs/common';
import { S3StorageService } from '../../../shared/infrastructure/s3-storage.service';
import { AttachmentRepository } from '../repositories/attachment.repository';

interface DeleteAttachmentProps {
  attachmentId: string;
}

export class DeleteAttachment {
  constructor(
    private readonly repository: AttachmentRepository,
    private readonly storage: S3StorageService,
  ) {}

  async execute(props: DeleteAttachmentProps): Promise<void> {
    const attachment = await this.repository.findById(props.attachmentId);
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    await this.storage.delete(attachment.s3Key);
    await this.repository.delete(props.attachmentId);
  }
}
