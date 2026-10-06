import { Query } from '../../../shared/domain/query';
import { PublicAnalyticsConfig, toPublicAnalyticsConfig } from '../../../config/domain/services/analytics-public-config';
import { WorkspaceAnalyticsSettingsRepository } from '../../domain/repositories/workspace-analytics-settings.repository';

interface Props {
  workspaceId: string;
}

export interface WorkspacePublicAnalyticsResponse {
  /** The workspace's own tracker, or null when it has none or its settings are incomplete. */
  analytics: PublicAnalyticsConfig | null;
  /** Whether the installation's analytics also receives this workspace's pages. */
  shareWithInstallation: boolean;
}

/** What any visitor's browser needs to track a workspace's pages. Public: carries no secret. */
export class GetWorkspacePublicAnalyticsQuery implements Query<Props, WorkspacePublicAnalyticsResponse> {
  constructor(private readonly repository: WorkspaceAnalyticsSettingsRepository) {}

  async execute(props: Props): Promise<WorkspacePublicAnalyticsResponse> {
    const settings = await this.repository.findByWorkspaceId(props.workspaceId);
    return {
      analytics: toPublicAnalyticsConfig(settings),
      shareWithInstallation: settings?.shareWithInstallation ?? true,
    };
  }
}
