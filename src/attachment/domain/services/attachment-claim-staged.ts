import { AttachmentRepository } from '../repositories/attachment.repository';

interface ClaimStagedAttachmentsProps {
  tokens: string[];
  ticketId: string;
  /** Who is creating the ticket; uploads staged by anyone else are left untouched. */
  uploadedById: string;
}

export class ClaimStagedAttachments {
  constructor(
    private readonly repository: AttachmentRepository,
  ) {}

  async execute(props: ClaimStagedAttachmentsProps): Promise<void> {
    if (props.tokens.length === 0) return;
    await this.repository.claimStagedAttachments(props.tokens, props.ticketId, props.uploadedById);
  }
}
