import { DomainValidationError } from '../../../shared/domain/errors';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { AnalyticsProvider } from '../../../config/domain/enums/analytics-provider.enum';
import {
  normalizeMatomoServerUrl,
  normalizeMatomoSiteId,
} from '../../../config/domain/services/matomo-settings-validation';
import { WorkspaceAnalyticsSettings } from '../entities/workspace-analytics-settings';
import { WorkspaceAnalyticsSettingsRepository } from '../repositories/workspace-analytics-settings.repository';

interface Props {
  workspaceId: string;
  provider?: AnalyticsProvider | null;
  serverUrl?: string | null;
  siteId?: string | null;
  useCookies?: boolean;
  trackEvents?: boolean;
  shareWithInstallation?: boolean;
}

export interface WorkspaceAnalyticsSettingsSnapshot {
  provider: AnalyticsProvider | null;
  serverUrl: string | null;
  siteId: string | null;
  useCookies: boolean;
  trackEvents: boolean;
  shareWithInstallation: boolean;
}

interface Result {
  settings: WorkspaceAnalyticsSettings;
  before: WorkspaceAnalyticsSettingsSnapshot;
  after: WorkspaceAnalyticsSettingsSnapshot;
}

/** The settings of a workspace without a row: no analytics of its own, sharing with the installation. */
export function defaultWorkspaceAnalyticsSnapshot(): WorkspaceAnalyticsSettingsSnapshot {
  return {
    provider: null,
    serverUrl: null,
    siteId: null,
    useCookies: false,
    trackEvents: true,
    shareWithInstallation: true,
  };
}

export function workspaceAnalyticsSnapshot(settings: WorkspaceAnalyticsSettings | null): WorkspaceAnalyticsSettingsSnapshot {
  if (!settings) return defaultWorkspaceAnalyticsSnapshot();
  return {
    provider: settings.provider,
    serverUrl: settings.serverUrl,
    siteId: settings.siteId,
    useCookies: settings.useCookies,
    trackEvents: settings.trackEvents,
    shareWithInstallation: settings.shareWithInstallation,
  };
}

/**
 * Patches a workspace's analytics: omitted fields keep their stored value. Turning the provider
 * off clears the Matomo fields but keeps shareWithInstallation, which does not depend on the
 * workspace having a Matomo of its own.
 */
export class UpdateWorkspaceAnalyticsSettings {
  constructor(
    private readonly repository: WorkspaceAnalyticsSettingsRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(props: Props): Promise<Result> {
    const current = await this.repository.findByWorkspaceId(props.workspaceId);
    const settings = current ?? new WorkspaceAnalyticsSettings({
      id: this.idGenerator.create(),
      workspaceId: props.workspaceId,
      provider: null,
      serverUrl: null,
      siteId: null,
    });
    const before = workspaceAnalyticsSnapshot(settings);

    const provider = props.provider !== undefined ? props.provider : settings.provider;

    // Everything is validated before the entity is touched, so a rejected patch changes nothing
    let next: Omit<WorkspaceAnalyticsSettingsSnapshot, 'shareWithInstallation'>;
    if (provider === null) {
      next = { provider: null, serverUrl: null, siteId: null, useCookies: false, trackEvents: true };
    } else if (provider === AnalyticsProvider.MATOMO) {
      next = {
        provider,
        serverUrl: normalizeMatomoServerUrl(props.serverUrl !== undefined ? props.serverUrl : settings.serverUrl),
        siteId: normalizeMatomoSiteId(props.siteId !== undefined ? props.siteId : settings.siteId),
        useCookies: typeof props.useCookies === 'boolean' ? props.useCookies : settings.useCookies,
        trackEvents: typeof props.trackEvents === 'boolean' ? props.trackEvents : settings.trackEvents,
      };
    } else {
      throw new DomainValidationError('Unsupported analytics provider');
    }

    settings.provider = next.provider;
    settings.serverUrl = next.serverUrl;
    settings.siteId = next.siteId;
    settings.useCookies = next.useCookies;
    settings.trackEvents = next.trackEvents;
    if (typeof props.shareWithInstallation === 'boolean') settings.shareWithInstallation = props.shareWithInstallation;

    await this.repository.save(settings);

    return { settings, before, after: workspaceAnalyticsSnapshot(settings) };
  }
}
