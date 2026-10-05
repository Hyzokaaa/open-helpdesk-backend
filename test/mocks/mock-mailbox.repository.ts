import { Mailbox } from '../../src/mailbox/domain/entities/mailbox';
import { MailboxType } from '../../src/mailbox/domain/enums/mailbox-type.enum';
import { MailboxRepository } from '../../src/mailbox/domain/repositories/mailbox.repository';

export class MockMailboxRepository implements MailboxRepository {
  private mailboxes: Mailbox[] = [];

  async create(mailbox: Mailbox): Promise<void> {
    this.mailboxes.push(mailbox);
  }

  async findById(id: string): Promise<Mailbox | null> {
    return this.mailboxes.find((m) => m.getId() === id) ?? null;
  }

  async findByAddress(address: string): Promise<Mailbox | null> {
    return this.mailboxes.find((m) => m.address === address) ?? null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Mailbox | null> {
    return this.mailboxes.find((m) => m.workspaceId === workspaceId) ?? null;
  }

  async findAllByWorkspaceId(workspaceId: string): Promise<Mailbox[]> {
    return this.mailboxes.filter((m) => m.workspaceId === workspaceId);
  }

  async findAllByType(type: MailboxType): Promise<Mailbox[]> {
    return this.mailboxes.filter((m) => m.type === type && m.isActive);
  }

  async update(mailbox: Mailbox): Promise<void> {
    const index = this.mailboxes.findIndex((m) => m.getId() === mailbox.getId());
    if (index >= 0) this.mailboxes[index] = mailbox;
  }

  async delete(id: string): Promise<void> {
    this.mailboxes = this.mailboxes.filter((m) => m.getId() !== id);
  }

  async findSystemMailbox(): Promise<Mailbox | null> {
    return this.mailboxes.find((m) => m.workspaceId === null) ?? null;
  }

  seed(mailbox: Mailbox): void {
    this.mailboxes.push(mailbox);
  }
}
