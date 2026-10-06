import { DomainValidationError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { SystemAnalyticsSettings } from '../entities/system-analytics-settings';
import { AnalyticsProvider } from '../enums/analytics-provider.enum';
import { SystemAnalyticsSettingsRepository } from '../repositories/system-analytics-settings.repository';
import { normalizeMatomoServerUrl, normalizeMatomoSiteId } from './matomo-settings-validation';

interface Props {
  provider?: AnalyticsProvider | null;
  serverUrl?: string | null;
  siteId?: string | null;
  useCookies?: boolean;
  trackEvents?: boolean;
}

export interface SystemAnalyticsSettingsSnapshot {
  provider: AnalyticsProvider | null;
  serverUrl: string | null;
  siteId: string | null;
  useCookies: boolean;
  trackEvents: boolean;
}

interface Result {
  settings: SystemAnalyticsSettings;
  before: SystemAnalyticsSettingsSnapshot;
  after: SystemAnalyticsSettingsSnapshot;
}

function snapshot(settings: SystemAnalyticsSettings): SystemAnalyticsSettingsSnapshot {
  return {
    provider: settings.provider,
    serverUrl: settings.serverUrl,
    siteId: settings.siteId,
    useCookies: settings.useCookies,
    trackEvents: settings.trackEvents,
  };
}

export class UpdateSystemAnalyticsSettings {
  constructor(
    private readonly repository: SystemAnalyticsSettingsRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(props: Props): Promise<Result> {
    const current = await this.repository.find();
    const settings = current ?? new SystemAnalyticsSettings({
      id: this.idGenerator.create(),
      provider: null,
      serverUrl: null,
      siteId: null,
    });
    const before = snapshot(settings);

    const provider = props.provider !== undefined ? props.provider : settings.provider;

    if (provider === null) {
      settings.provider = null;
      settings.serverUrl = null;
      settings.siteId = null;
      settings.useCookies = false;
      settings.trackEvents = true;
    } else if (provider === AnalyticsProvider.MATOMO) {
      settings.provider = provider;
      settings.serverUrl = normalizeMatomoServerUrl(props.serverUrl !== undefined ? props.serverUrl : settings.serverUrl);
      settings.siteId = normalizeMatomoSiteId(props.siteId !== undefined ? props.siteId : settings.siteId);
      if (props.useCookies !== undefined) settings.useCookies = props.useCookies;
      if (props.trackEvents !== undefined) settings.trackEvents = props.trackEvents;
    } else {
      throw new DomainValidationError('Unsupported analytics provider');
    }

    await this.repository.save(settings);

    return { settings, before, after: snapshot(settings) };
  }
}
