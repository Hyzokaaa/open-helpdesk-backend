import { DomainValidationError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { Mailbox } from '../entities/mailbox';
import { MailboxRepository } from '../repositories/mailbox.repository';
import { MailboxType } from '../enums/mailbox-type.enum';

interface CreateImapMailboxProps {
  workspaceId: string;
  address: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapTls?: boolean;
  imapFolder?: string;
  pollInterval?: number;
}

export class CreateImapMailbox {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: MailboxRepository,
  ) {}

  async execute(props: CreateImapMailboxProps): Promise<Mailbox> {
    const existing = await this.repository.findByAddress(props.address);
    if (existing) {
      throw new DomainValidationError('A mailbox with this address already exists');
    }

    const mailbox = new Mailbox({
      id: this.idGenerator.create(),
      address: props.address,
      workspaceId: props.workspaceId,
      isActive: true,
      type: MailboxType.IMAP,
      imapHost: props.imapHost,
      imapPort: props.imapPort,
      imapUser: props.imapUser,
      imapPass: props.imapPass,
      imapTls: props.imapTls ?? true,
      imapFolder: props.imapFolder ?? 'INBOX',
      pollInterval: props.pollInterval ?? 30,
    });

    await this.repository.create(mailbox);
    return mailbox;
  }
}
