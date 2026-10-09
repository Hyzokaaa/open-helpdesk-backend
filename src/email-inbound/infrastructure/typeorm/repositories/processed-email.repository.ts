import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProcessedEmailModel } from '../models/processed-email.model';

/** Marks from before each mailbox kept its own: they stand for every mailbox */
const ANY_MAILBOX = '*';

@Injectable()
export class ProcessedEmailRepository {
  constructor(
    @InjectRepository(ProcessedEmailModel)
    private readonly repository: Repository<ProcessedEmailModel>,
  ) {}

  /** Whether this mailbox already handled the message; entries from before mailboxes were told apart count for all */
  async exists(messageId: string, mailboxId: string): Promise<boolean> {
    const count = await this.repository.countBy({ messageId, mailboxId: In([mailboxId, ANY_MAILBOX]) });
    return count > 0;
  }

  async markProcessed(messageId: string, mailboxId: string): Promise<void> {
    await this.repository.save({ messageId, mailboxId });
  }
}
