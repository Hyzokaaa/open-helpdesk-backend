import { AuditRetentionSettings } from '../entities/audit-retention-settings';

export interface AuditRetentionSettingsRepository {
  find(): Promise<AuditRetentionSettings | null>;
  save(settings: AuditRetentionSettings): Promise<void>;
}
