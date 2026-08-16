import { Command } from '../../../shared/domain/command';
import { SetBranding } from '../../domain/services/workspace-set-branding';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  workspaceId: string;
  userId: string;
  appName?: string | null;
  appSubtitle?: string | null;
}

export interface SetBrandingResponse {
  appName: string | null;
  appSubtitle: string | null;
}

export class SetBrandingCommand implements Command<Props, SetBrandingResponse> {
  constructor(
    private readonly setBranding: SetBranding,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<SetBrandingResponse> {
    const workspace = await this.setBranding.execute({
      workspaceId: props.workspaceId,
      appName: props.appName,
      appSubtitle: props.appSubtitle,
    });

    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_BRANDING_UPDATED,
      entityType: 'workspace',
      entityId: workspace.getId(),
      userId: props.userId,
      workspaceId: workspace.getId(),
      metadata: { appName: workspace.appName, appSubtitle: workspace.appSubtitle },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return {
      appName: workspace.appName,
      appSubtitle: workspace.appSubtitle,
    };
  }
}
