import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemNotificationSettings } from '../../../domain/entities/system-notification-settings';
import { SystemNotificationSettingsModel } from '../models/system-notification-settings.model';

@Injectable()
export class TypeOrmSystemNotificationSettingsRepository {
  constructor(
    @InjectRepository(SystemNotificationSettingsModel)
    private readonly repository: Repository<SystemNotificationSettingsModel>,
  ) {}

  async find(): Promise<SystemNotificationSettings | null> {
    const model = await this.repository.findOne({ where: {} });
    if (!model) return null;
    return new SystemNotificationSettings({
      id: model.id,
      upgradeEnabled: model.upgradeEnabled,
      upgradeEmail: model.upgradeEmail,
      upgradeInApp: model.upgradeInApp,
      lastNotifiedVersion: model.lastNotifiedVersion,
    });
  }

  async save(settings: SystemNotificationSettings): Promise<void> {
    await this.repository.save({
      id: settings.id,
      upgradeEnabled: settings.upgradeEnabled,
      upgradeEmail: settings.upgradeEmail,
      upgradeInApp: settings.upgradeInApp,
      lastNotifiedVersion: settings.lastNotifiedVersion,
    });
  }
}
