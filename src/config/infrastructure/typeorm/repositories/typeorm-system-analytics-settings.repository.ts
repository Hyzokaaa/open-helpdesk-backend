import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemAnalyticsSettings } from '../../../domain/entities/system-analytics-settings';
import { SystemAnalyticsSettingsRepository } from '../../../domain/repositories/system-analytics-settings.repository';
import { SystemAnalyticsSettingsModel } from '../models/system-analytics-settings.model';

@Injectable()
export class TypeOrmSystemAnalyticsSettingsRepository implements SystemAnalyticsSettingsRepository {
  constructor(
    @InjectRepository(SystemAnalyticsSettingsModel)
    private readonly repository: Repository<SystemAnalyticsSettingsModel>,
  ) {}

  async find(): Promise<SystemAnalyticsSettings | null> {
    const model = await this.repository.findOne({ where: {} });
    if (!model) return null;
    return this.toDomain(model);
  }

  async save(settings: SystemAnalyticsSettings): Promise<void> {
    await this.repository.save(this.toModel(settings));
  }

  private toDomain(model: SystemAnalyticsSettingsModel): SystemAnalyticsSettings {
    return new SystemAnalyticsSettings({
      id: model.id,
      provider: model.provider,
      serverUrl: model.serverUrl,
      siteId: model.siteId,
      useCookies: model.useCookies,
      trackEvents: model.trackEvents,
    });
  }

  private toModel(settings: SystemAnalyticsSettings): Partial<SystemAnalyticsSettingsModel> {
    return {
      id: settings.id,
      provider: settings.provider,
      serverUrl: settings.serverUrl,
      siteId: settings.siteId,
      useCookies: settings.useCookies,
      trackEvents: settings.trackEvents,
    };
  }
}
