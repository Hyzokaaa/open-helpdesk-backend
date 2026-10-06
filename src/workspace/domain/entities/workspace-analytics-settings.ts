import { Id } from '../../../shared/domain/id';
import { AnalyticsProvider } from '../../../config/domain/enums/analytics-provider.enum';

interface Props {
  id: string;
  workspaceId: string;
  provider: AnalyticsProvider | null;
  serverUrl: string | null;
  siteId: string | null;
  useCookies?: boolean;
  trackEvents?: boolean;
  shareWithInstallation?: boolean;
}

/**
 * Where a workspace sends its own analytics (the customer's Matomo), and whether the
 * installation's analytics also receives the workspace's pages. A workspace without a row has
 * no analytics of its own and shares with the installation.
 */
export class WorkspaceAnalyticsSettings {
  readonly id: Id;
  workspaceId: string;
  provider: AnalyticsProvider | null;
  serverUrl: string | null;
  siteId: string | null;
  useCookies: boolean;
  trackEvents: boolean;
  shareWithInstallation: boolean;

  constructor(props: Props) {
    this.id = new Id(props.id);
    this.workspaceId = props.workspaceId;
    this.provider = props.provider ?? null;
    this.serverUrl = props.serverUrl ?? null;
    this.siteId = props.siteId ?? null;
    this.useCookies = props.useCookies ?? false;
    this.trackEvents = props.trackEvents ?? true;
    this.shareWithInstallation = props.shareWithInstallation ?? true;
  }

  getId(): string {
    return this.id.get();
  }
}
