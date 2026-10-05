import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceCreationSettings } from '../../../domain/entities/workspace-creation-settings';
import { WorkspaceCreationSettingsRepository } from '../../../domain/repositories/workspace-creation-settings.repository';
import { WorkspaceCreationSettingsModel } from '../models/workspace-creation-settings.model';

@Injectable()
export class TypeOrmWorkspaceCreationSettingsRepository implements WorkspaceCreationSettingsRepository {
  constructor(
    @InjectRepository(WorkspaceCreationSettingsModel)
    private readonly repository: Repository<WorkspaceCreationSettingsModel>,
  ) {}

  async find(): Promise<WorkspaceCreationSettings | null> {
    const model = await this.repository.findOne({ where: {} });
    return model ? new WorkspaceCreationSettings({ id: model.id, selfService: model.selfService }) : null;
  }

  async save(settings: WorkspaceCreationSettings): Promise<void> {
    await this.repository.save({ id: settings.id, selfService: settings.selfService });
  }
}
