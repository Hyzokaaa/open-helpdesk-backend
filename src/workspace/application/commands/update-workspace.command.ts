import { Command } from '../../../shared/domain/command';
import { UpdateWorkspace } from '../../domain/services/workspace-update';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  workspaceId: string;
  name?: string;
  description?: string;
  isSystemAdmin: boolean;
  userId: string;
}

export interface UpdateWorkspaceResponse {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export class UpdateWorkspaceCommand implements Command<Props, UpdateWorkspaceResponse> {
  constructor(
    private readonly updateWorkspace: UpdateWorkspace,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<UpdateWorkspaceResponse> {
    const workspace = await this.updateWorkspace.execute(props);

    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_UPDATED,
      entityType: 'workspace',
      entityId: workspace.getId(),
      userId: props.userId,
      workspaceId: workspace.getId(),
      metadata: { name: props.name, description: props.description },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return {
      id: workspace.getId(),
      name: workspace.name,
      slug: workspace.slug,
      description: workspace.description,
    };
  }
}
