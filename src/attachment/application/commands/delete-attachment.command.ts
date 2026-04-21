import { Command } from '../../../shared/domain/command';
import { DeleteAttachment } from '../../domain/services/attachment-delete';

interface Props {
  attachmentId: string;
}

export class DeleteAttachmentCommand implements Command<Props, void> {
  constructor(private readonly deleteAttachment: DeleteAttachment) {}

  async execute(props: Props): Promise<void> {
    await this.deleteAttachment.execute({ attachmentId: props.attachmentId });
  }
}
