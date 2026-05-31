import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessedEmailModel } from '../models/processed-email.model';

@Injectable()
export class ProcessedEmailRepository {
  constructor(
    @InjectRepository(ProcessedEmailModel)
    private readonly repository: Repository<ProcessedEmailModel>,
  ) {}

  async exists(messageId: string): Promise<boolean> {
    const count = await this.repository.countBy({ messageId });
    return count > 0;
  }

  async markProcessed(messageId: string): Promise<void> {
    await this.repository.save({ messageId });
  }
}
