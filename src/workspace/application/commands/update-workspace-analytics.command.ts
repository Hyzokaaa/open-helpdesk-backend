import { Command } from '../../../shared/domain/command';
import { AnalyticsProvider } from '../../../config/domain/enums/analytics-provider.enum';
import { UpdateWorkspaceAnalyticsSettings } from '../../domain/services/workspace-analytics-update';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { WorkspaceAnalyticsResponse } from '../queries/get-workspace-analytics.query';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
  provider?: AnalyticsProvider | null;
  serverUrl?: string | null;
  siteId?: string | null;
  useCookies?: boolean;
  trackEvents?: boolean;
  shareWithInstallation?: boolean;
}

export class UpdateWorkspaceAnalyticsCommand implements Command<Props, WorkspaceAnalyticsResponse> {
  constructor(
    private readonly updateSettings: UpdateWorkspaceAnalyticsSettings,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<WorkspaceAnalyticsResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_ANALYTICS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const { before, after } = await this.updateSettings.execute({
      workspaceId: props.workspaceId,
      provider: props.provider,
      serverUrl: props.serverUrl,
      siteId: props.siteId,
      useCookies: props.useCookies,
      trackEvents: props.trackEvents,
      shareWithInstallation: props.shareWithInstallation,
    });

    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_ANALYTICS_UPDATED,
      entityType: 'workspace',
      entityId: props.workspaceId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: { before, after },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return {
      provider: after.provider,
      serverUrl: after.serverUrl,
      siteId: after.siteId,
      useCookies: after.useCookies,
      trackEvents: after.trackEvents,
      shareWithInstallation: after.shareWithInstallation,
    };
  }
}
