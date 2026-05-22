import { Mailbox } from '../entities/mailbox';

export interface MailboxRepository {
  create(mailbox: Mailbox): Promise<void>;
  findByAddress(address: string): Promise<Mailbox | null>;
  findByWorkspaceId(workspaceId: string): Promise<Mailbox | null>;
}
