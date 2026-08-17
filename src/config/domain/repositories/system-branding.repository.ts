import { SystemBranding } from '../entities/system-branding';

export interface SystemBrandingRepository {
  find(): Promise<SystemBranding | null>;
  save(branding: SystemBranding): Promise<void>;
}
