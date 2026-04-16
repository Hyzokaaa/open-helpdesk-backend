import { Command } from '../../../shared/domain/command';
import { CreateAttachment } from '../../domain/services/attachment-create';

interface Props {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  ticketId: string | null;
  commentId: string | null;
}

export interface UploadAttachmentResponse {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export class UploadAttachmentCommand implements Command<Props, UploadAttachmentResponse> {
  constructor(private readonly createAttachment: CreateAttachment) {}

  async execute(props: Props): Promise<UploadAttachmentResponse> {
    const attachment = await this.createAttachment.execute({
      buffer: props.buffer,
      originalName: props.originalName,
      mimeType: props.mimeType,
      size: props.size,
      ticketId: props.ticketId,
      commentId: props.commentId,
    });

    return {
      id: attachment.getId(),
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }
}
