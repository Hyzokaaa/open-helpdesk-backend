import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditRetentionSettings } from '../../../domain/entities/audit-retention-settings';
import { AuditRetentionSettingsRepository } from '../../../domain/repositories/audit-retention-settings.repository';
import { AuditRetentionSettingsModel } from '../models/audit-retention-settings.model';

@Injectable()
export class TypeOrmAuditRetentionSettingsRepository implements AuditRetentionSettingsRepository {
  constructor(
    @InjectRepository(AuditRetentionSettingsModel)
    private readonly repository: Repository<AuditRetentionSettingsModel>,
  ) {}

  async find(): Promise<AuditRetentionSettings | null> {
    const model = await this.repository.findOne({ where: {} });
    return model ? new AuditRetentionSettings({ id: model.id, enabled: model.enabled, days: model.days ?? {} }) : null;
  }

  async save(settings: AuditRetentionSettings): Promise<void> {
    await this.repository.save({ id: settings.id, enabled: settings.enabled, days: settings.days });
  }
}
