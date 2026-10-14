import { Mailbox } from '../../../mailbox/domain/entities/mailbox';
import { MailboxRepository } from '../../../mailbox/domain/repositories/mailbox.repository';
import { MailboxType } from '../../../mailbox/domain/enums/mailbox-type.enum';

/**
 * The mailbox a reply to a ticket email should go to: the one the ticket came through, or,
 * for tickets opened in the app, the portal or the API, an active mailbox of the workspace.
 * Null when the workspace reads no mailbox, so emails do not invite a reply nobody would read.
 */
export class ResolveTicketReplyMailbox {
  constructor(private readonly mailboxRepository: MailboxRepository) {}

  async execute(props: { ticketMailboxId?: string | null; workspaceId: string }): Promise<Mailbox | null> {
    if (props.ticketMailboxId) {
      const own = await this.mailboxRepository.findById(props.ticketMailboxId);
      if (own?.isActive) return own;
    }
    const active = (await this.mailboxRepository.findAllByWorkspaceId(props.workspaceId)).filter((m) => m.isActive);
    return active.find((m) => m.type === MailboxType.IMAP) ?? active[0] ?? null;
  }
}
