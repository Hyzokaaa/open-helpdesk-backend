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
  /** What the workspace held when it was deleted, for the record. */
  stats?: { memberCount: number; ticketCount: number };
}

export class DeleteWorkspaceCommand implements Command<Props, void> {
  constructor(
    private readonly deleteWorkspace: DeleteWorkspace,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<void> {
    // Recorded only once it happened: a refused attempt must not read as a deletion
    const workspace = await this.deleteWorkspace.execute(props);

    // The entry cannot point at the deleted workspace, so it carries what identifies it
    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_DELETED,
      entityType: 'workspace',
      entityId: props.workspaceId,
      userId: props.userId,
      workspaceId: null,
      metadata: {
        workspaceId: props.workspaceId,
        name: workspace.name,
        slug: workspace.slug,
        ...(props.stats ?? {}),
      },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.WARNING,
      source: 'ui',
    });
  }
}
