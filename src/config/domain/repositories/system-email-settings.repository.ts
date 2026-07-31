import { SystemEmailSettings } from '../entities/system-email-settings';

export interface SystemEmailSettingsRepository {
  find(): Promise<SystemEmailSettings | null>;
  save(settings: SystemEmailSettings): Promise<void>;
  delete(): Promise<void>;
}
