import { SystemAnalyticsSettings } from '../../src/config/domain/entities/system-analytics-settings';
import { SystemAnalyticsSettingsRepository } from '../../src/config/domain/repositories/system-analytics-settings.repository';

export class MockSystemAnalyticsSettingsRepository implements SystemAnalyticsSettingsRepository {
  private settings: SystemAnalyticsSettings | null = null;

  async find(): Promise<SystemAnalyticsSettings | null> {
    return this.settings ? new SystemAnalyticsSettings({ ...this.settings }) : null;
  }

  async save(settings: SystemAnalyticsSettings): Promise<void> {
    this.settings = new SystemAnalyticsSettings({ ...settings });
  }
}
