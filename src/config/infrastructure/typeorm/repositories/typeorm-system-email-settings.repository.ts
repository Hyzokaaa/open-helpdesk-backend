import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemEmailSettings } from '../../../domain/entities/system-email-settings';
import { SystemEmailSettingsRepository } from '../../../domain/repositories/system-email-settings.repository';
import { SystemEmailSettingsModel } from '../models/system-email-settings.model';

@Injectable()
export class TypeOrmSystemEmailSettingsRepository implements SystemEmailSettingsRepository {
  constructor(
    @InjectRepository(SystemEmailSettingsModel)
    private readonly repository: Repository<SystemEmailSettingsModel>,
  ) {}

  async find(): Promise<SystemEmailSettings | null> {
    const model = await this.repository.findOne({ where: {} });
    if (!model) return null;
    return new SystemEmailSettings({
      id: model.id,
      smtpHost: model.smtpHost,
      smtpPort: model.smtpPort,
      smtpUser: model.smtpUser,
      smtpPass: model.smtpPass,
      smtpFrom: model.smtpFrom,
      encryption: model.encryption,
    });
  }

  async save(settings: SystemEmailSettings): Promise<void> {
    await this.repository.save({
      id: settings.getId(),
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpPass: settings.smtpPass,
      smtpFrom: settings.smtpFrom,
      encryption: settings.encryption,
    });
  }

  async delete(): Promise<void> {
    await this.repository.clear();
  }
}
