import { SystemAnalyticsSettings } from '../entities/system-analytics-settings';
import { AnalyticsProvider } from '../enums/analytics-provider.enum';

export interface PublicAnalyticsConfig {
  provider: AnalyticsProvider.MATOMO;
  serverUrl: string;
  siteId: string;
  useCookies: boolean;
  trackEvents: boolean;
}

/**
 * The analytics settings the browser needs to load the tracker, or null when
 * analytics is off or the stored settings are incomplete.
 */
export function toPublicAnalyticsConfig(settings: SystemAnalyticsSettings | null): PublicAnalyticsConfig | null {
  if (!settings) return null;
  if (settings.provider !== AnalyticsProvider.MATOMO) return null;
  if (!settings.serverUrl || !settings.siteId) return null;
  return {
    provider: AnalyticsProvider.MATOMO,
    serverUrl: settings.serverUrl,
    siteId: settings.siteId,
    useCookies: settings.useCookies,
    trackEvents: settings.trackEvents,
  };
}
