import { SystemAnalyticsSettings } from '../entities/system-analytics-settings';

export interface SystemAnalyticsSettingsRepository {
  find(): Promise<SystemAnalyticsSettings | null>;
  save(settings: SystemAnalyticsSettings): Promise<void>;
}
