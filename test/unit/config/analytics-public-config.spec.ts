import { toPublicAnalyticsConfig } from '../../../src/config/domain/services/analytics-public-config';
import { SystemAnalyticsSettings } from '../../../src/config/domain/entities/system-analytics-settings';
import { AnalyticsProvider } from '../../../src/config/domain/enums/analytics-provider.enum';

function settings(overrides: Partial<SystemAnalyticsSettings> = {}): SystemAnalyticsSettings {
  return new SystemAnalyticsSettings({
    id: 'id-1',
    provider: AnalyticsProvider.MATOMO,
    serverUrl: 'https://stats.example.com/',
    siteId: '3',
    useCookies: true,
    trackEvents: false,
    ...overrides,
  });
}

describe('toPublicAnalyticsConfig', () => {
  it('exposes a complete Matomo configuration without the id', () => {
    expect(toPublicAnalyticsConfig(settings())).toEqual({
      provider: 'matomo',
      serverUrl: 'https://stats.example.com/',
      siteId: '3',
      useCookies: true,
      trackEvents: false,
    });
  });

  it('returns null when nothing is stored', () => {
    expect(toPublicAnalyticsConfig(null)).toBeNull();
  });

  it('returns null when analytics is off', () => {
    expect(toPublicAnalyticsConfig(settings({ provider: null }))).toBeNull();
  });

  it('returns null when the Matomo settings are incomplete', () => {
    expect(toPublicAnalyticsConfig(settings({ serverUrl: null }))).toBeNull();
    expect(toPublicAnalyticsConfig(settings({ siteId: null }))).toBeNull();
  });
});
