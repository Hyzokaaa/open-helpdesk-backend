import { Command } from '../../../shared/domain/command';
import { StageAttachment } from '../../domain/services/attachment-stage';

interface Props {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedById: string;
}

export interface StageUploadResponse {
  token: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export class StageUploadCommand implements Command<Props, StageUploadResponse> {
  constructor(private readonly stageAttachment: StageAttachment) {}

  async execute(props: Props): Promise<StageUploadResponse> {
    const attachment = await this.stageAttachment.execute({
      buffer: props.buffer,
      originalName: props.originalName,
      mimeType: props.mimeType,
      size: props.size,
      uploadedById: props.uploadedById,
    });

    return {
      token: attachment.token!,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }
}
