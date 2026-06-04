import { AttachmentRepository } from '../repositories/attachment.repository';

interface ClaimStagedAttachmentsProps {
  tokens: string[];
  ticketId: string;
}

export class ClaimStagedAttachments {
  constructor(
    private readonly repository: AttachmentRepository,
  ) {}

  async execute(props: ClaimStagedAttachmentsProps): Promise<void> {
    if (props.tokens.length === 0) return;
    await this.repository.claimStagedAttachments(props.tokens, props.ticketId);
  }
}
