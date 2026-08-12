import { IdGenerator } from '../../../shared/domain/id-generator';
import { Mailbox } from '../entities/mailbox';
import { MailboxRepository } from '../repositories/mailbox.repository';

interface CreateMailboxProps {
  workspaceSlug: string;
  workspaceId: string;
  emailDomain: string;
}

export class CreateMailbox {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: MailboxRepository,
  ) {}

  async execute(props: CreateMailboxProps): Promise<Mailbox> {
    const address = `${props.workspaceSlug}@${props.emailDomain}`;

    const existing = await this.repository.findByWorkspaceId(props.workspaceId);
    if (existing) {
      return existing;
    }

    const mailbox = new Mailbox({
      id: this.idGenerator.create(),
      address,
      workspaceId: props.workspaceId,
      isActive: false,
    });

    await this.repository.create(mailbox);
    return mailbox;
  }
}
