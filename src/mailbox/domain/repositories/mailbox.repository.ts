import { Mailbox } from '../entities/mailbox';
import { MailboxType } from '../enums/mailbox-type.enum';

export interface MailboxRepository {
  create(mailbox: Mailbox): Promise<void>;
  findById(id: string): Promise<Mailbox | null>;
  findByAddress(address: string): Promise<Mailbox | null>;
  findByWorkspaceId(workspaceId: string): Promise<Mailbox | null>;
  findAllByWorkspaceId(workspaceId: string): Promise<Mailbox[]>;
  findAllByType(type: MailboxType): Promise<Mailbox[]>;
  update(mailbox: Mailbox): Promise<void>;
  delete(id: string): Promise<void>;
  findSystemMailbox(): Promise<Mailbox | null>;
}
