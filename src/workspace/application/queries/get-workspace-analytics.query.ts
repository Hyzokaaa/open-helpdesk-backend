import { Query } from '../../../shared/domain/query';
import { AnalyticsProvider } from '../../../config/domain/enums/analytics-provider.enum';
import { WorkspaceAnalyticsSettingsRepository } from '../../domain/repositories/workspace-analytics-settings.repository';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { workspaceAnalyticsSnapshot } from '../../domain/services/workspace-analytics-update';
import { PERMISSIONS } from '../../domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface WorkspaceAnalyticsResponse {
  provider: AnalyticsProvider | null;
  serverUrl: string | null;
  siteId: string | null;
  useCookies: boolean;
  trackEvents: boolean;
  shareWithInstallation: boolean;
}

export class GetWorkspaceAnalyticsQuery implements Query<Props, WorkspaceAnalyticsResponse> {
  constructor(
    private readonly repository: WorkspaceAnalyticsSettingsRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<WorkspaceAnalyticsResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_ANALYTICS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const snapshot = workspaceAnalyticsSnapshot(await this.repository.findByWorkspaceId(props.workspaceId));
    return {
      provider: snapshot.provider,
      serverUrl: snapshot.serverUrl,
      siteId: snapshot.siteId,
      useCookies: snapshot.useCookies,
      trackEvents: snapshot.trackEvents,
      shareWithInstallation: snapshot.shareWithInstallation,
    };
  }
}
