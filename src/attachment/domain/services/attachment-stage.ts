import { randomUUID } from 'crypto';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { StorageService } from '../../../shared/domain/storage-service';
import { Attachment } from '../entities/attachment';
import { AttachmentRepository } from '../repositories/attachment.repository';

interface StageAttachmentProps {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedById: string;
}

export class StageAttachment {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: AttachmentRepository,
    private readonly storage: StorageService,
  ) {}

  async execute(props: StageAttachmentProps): Promise<Attachment> {
    const id = this.idGenerator.create();
    const token = randomUUID();
    const s3Key = `attachments/${id}/${props.originalName}`;

    await this.storage.upload(props.buffer, s3Key, props.mimeType);

    const attachment = new Attachment({
      id,
      fileName: props.originalName,
      originalName: props.originalName,
      mimeType: props.mimeType,
      size: props.size,
      s3Key,
      ticketId: null,
      commentId: null,
      uploadedById: props.uploadedById,
      token,
      stagedAt: new Date(),
    });

    await this.repository.create(attachment);
    return attachment;
  }
}
