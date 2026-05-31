import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Mailbox } from '../entities/mailbox';
import { MailboxRepository } from '../repositories/mailbox.repository';

interface UpdateMailboxProps {
  id: string;
  address?: string;
  isActive?: boolean;
  imapHost?: string | null;
  imapPort?: number | null;
  imapUser?: string | null;
  imapPass?: string | null;
  imapTls?: boolean | null;
  imapFolder?: string | null;
  pollInterval?: number | null;
}

export class UpdateMailbox {
  constructor(private readonly repository: MailboxRepository) {}

  async execute(props: UpdateMailboxProps): Promise<Mailbox> {
    const mailbox = await this.repository.findById(props.id);
    if (!mailbox) throw new EntityNotFoundError('Mailbox not found');

    if (props.address !== undefined) mailbox.address = props.address;
    if (props.isActive !== undefined) mailbox.isActive = props.isActive;
    if (props.imapHost !== undefined) mailbox.imapHost = props.imapHost;
    if (props.imapPort !== undefined) mailbox.imapPort = props.imapPort;
    if (props.imapUser !== undefined) mailbox.imapUser = props.imapUser;
    if (props.imapPass !== undefined) mailbox.imapPass = props.imapPass;
    if (props.imapTls !== undefined) mailbox.imapTls = props.imapTls;
    if (props.imapFolder !== undefined) mailbox.imapFolder = props.imapFolder;
    if (props.pollInterval !== undefined) mailbox.pollInterval = props.pollInterval;

    await this.repository.update(mailbox);
    return mailbox;
  }
}
