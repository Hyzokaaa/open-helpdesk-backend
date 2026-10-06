import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceAnalyticsSettings } from '../../../domain/entities/workspace-analytics-settings';
import { WorkspaceAnalyticsSettingsRepository } from '../../../domain/repositories/workspace-analytics-settings.repository';
import { WorkspaceAnalyticsSettingsModel } from '../models/workspace-analytics-settings.model';

@Injectable()
export class TypeOrmWorkspaceAnalyticsSettingsRepository implements WorkspaceAnalyticsSettingsRepository {
  constructor(
    @InjectRepository(WorkspaceAnalyticsSettingsModel)
    private readonly repository: Repository<WorkspaceAnalyticsSettingsModel>,
  ) {}

  async findByWorkspaceId(workspaceId: string): Promise<WorkspaceAnalyticsSettings | null> {
    const model = await this.repository.findOneBy({ workspaceId });
    return model ? this.toDomain(model) : null;
  }

  async save(settings: WorkspaceAnalyticsSettings): Promise<void> {
    await this.repository.save(this.toModel(settings));
  }

  private toDomain(model: WorkspaceAnalyticsSettingsModel): WorkspaceAnalyticsSettings {
    return new WorkspaceAnalyticsSettings({
      id: model.id,
      workspaceId: model.workspaceId,
      provider: model.provider,
      serverUrl: model.serverUrl,
      siteId: model.siteId,
      useCookies: model.useCookies,
      trackEvents: model.trackEvents,
      shareWithInstallation: model.shareWithInstallation,
    });
  }

  private toModel(settings: WorkspaceAnalyticsSettings): WorkspaceAnalyticsSettingsModel {
    const model = new WorkspaceAnalyticsSettingsModel();
    model.id = settings.getId();
    model.workspaceId = settings.workspaceId;
    model.provider = settings.provider;
    model.serverUrl = settings.serverUrl;
    model.siteId = settings.siteId;
    model.useCookies = settings.useCookies;
    model.trackEvents = settings.trackEvents;
    model.shareWithInstallation = settings.shareWithInstallation;
    return model;
  }
}
