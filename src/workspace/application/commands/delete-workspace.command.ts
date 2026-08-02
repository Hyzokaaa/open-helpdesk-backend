import { Command } from '../../../shared/domain/command';
import { DeleteWorkspace } from '../../domain/services/workspace-delete';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  workspaceId: string;
  isSystemAdmin: boolean;
  userId: string;
}

export class DeleteWorkspaceCommand implements Command<Props, void> {
  constructor(
    private readonly deleteWorkspace: DeleteWorkspace,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_DELETED,
      entityType: 'workspace',
      entityId: props.workspaceId,
      userId: props.userId,
      workspaceId: null,
      metadata: null,
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    await this.deleteWorkspace.execute(props);
  }
}
