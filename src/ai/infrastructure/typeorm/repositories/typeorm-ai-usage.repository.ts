import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageRepository } from '../../../domain/repositories/ai-usage.repository';
import { AiUsageModel } from '../models/ai-usage.model';
import { ulid } from 'ulid';

@Injectable()
export class TypeOrmAiUsageRepository implements AiUsageRepository {
  constructor(
    @InjectRepository(AiUsageModel)
    private readonly repository: Repository<AiUsageModel>,
  ) {}

  async increment(workspaceId: string, month: string): Promise<number> {
    const existing = await this.repository.findOneBy({ workspaceId, month });
    if (existing) {
      existing.count += 1;
      await this.repository.save(existing);
      return existing.count;
    }

    const model = new AiUsageModel();
    model.id = ulid();
    model.workspaceId = workspaceId;
    model.month = month;
    model.count = 1;
    await this.repository.save(model);
    return 1;
  }

  async getCount(workspaceId: string, month: string): Promise<number> {
    const existing = await this.repository.findOneBy({ workspaceId, month });
    return existing?.count ?? 0;
  }
}
