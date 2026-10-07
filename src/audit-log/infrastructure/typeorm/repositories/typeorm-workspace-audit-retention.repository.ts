import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceAuditRetention } from '../../../domain/entities/workspace-audit-retention';
import { WorkspaceAuditRetentionRepository } from '../../../domain/repositories/workspace-audit-retention.repository';
import { WorkspaceAuditRetentionModel } from '../models/workspace-audit-retention.model';

@Injectable()
export class TypeOrmWorkspaceAuditRetentionRepository implements WorkspaceAuditRetentionRepository {
  constructor(
    @InjectRepository(WorkspaceAuditRetentionModel)
    private readonly repository: Repository<WorkspaceAuditRetentionModel>,
  ) {}

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceAuditRetention | null> {
    const model = await this.repository.findOneBy({ workspaceId });
    return model ? new WorkspaceAuditRetention({ workspaceId: model.workspaceId, days: model.days ?? {} }) : null;
  }

  async save(retention: WorkspaceAuditRetention): Promise<void> {
    await this.repository.save({ workspaceId: retention.workspaceId, days: retention.days });
  }
}
