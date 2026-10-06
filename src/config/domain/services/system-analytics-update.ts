import { DomainValidationError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { SystemAnalyticsSettings } from '../entities/system-analytics-settings';
import { AnalyticsProvider } from '../enums/analytics-provider.enum';
import { SystemAnalyticsSettingsRepository } from '../repositories/system-analytics-settings.repository';

const SITE_ID_REGEX = /^[1-9][0-9]{0,9}$/;

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

function normalizeServerUrl(value: string | null): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') throw new DomainValidationError('Server URL is required for Matomo');

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new DomainValidationError('Server URL is not a valid URL');
  }

  if (url.protocol !== 'https:') throw new DomainValidationError('Server URL must use https');
  if (url.username || url.password) throw new DomainValidationError('Server URL must not contain credentials');
  if (url.search) throw new DomainValidationError('Server URL must not contain a query string');
  if (url.hash) throw new DomainValidationError('Server URL must not contain a fragment');

  const path = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  return `${url.origin}${path}`;
}

function normalizeSiteId(value: string | null): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed === '') throw new DomainValidationError('Site ID is required for Matomo');
  if (!SITE_ID_REGEX.test(trimmed)) {
    throw new DomainValidationError('Site ID must be a positive integer of at most 10 digits');
  }
  return trimmed;
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
      settings.serverUrl = normalizeServerUrl(props.serverUrl !== undefined ? props.serverUrl : settings.serverUrl);
      settings.siteId = normalizeSiteId(props.siteId !== undefined ? props.siteId : settings.siteId);
      if (props.useCookies !== undefined) settings.useCookies = props.useCookies;
      if (props.trackEvents !== undefined) settings.trackEvents = props.trackEvents;
    } else {
      throw new DomainValidationError('Unsupported analytics provider');
    }

    await this.repository.save(settings);

    return { settings, before, after: snapshot(settings) };
  }
}
