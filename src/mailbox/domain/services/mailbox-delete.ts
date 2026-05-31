import { EntityNotFoundError } from '../../../shared/domain/errors';
import { MailboxRepository } from '../repositories/mailbox.repository';

export class DeleteMailbox {
  constructor(private readonly repository: MailboxRepository) {}

  async execute(id: string): Promise<void> {
    const mailbox = await this.repository.findById(id);
    if (!mailbox) throw new EntityNotFoundError('Mailbox not found');
    await this.repository.delete(id);
  }
}
