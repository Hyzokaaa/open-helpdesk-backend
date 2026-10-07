import { Command } from '../../../shared/domain/command';
import { AccessDeniedError } from '../../../shared/domain/errors';
import { PurgeWorkspace } from '../../domain/services/workspace-purge';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  workspaceId: string;
  /** The system admin who purges it ahead of time; null when the scheduler does, on its date. */
  userId: string | null;
  isSystemAdmin: boolean;
  /** What it held, read before the rows are gone. */
  stats?: { memberCount: number; ticketCount: number };
}

export interface PurgeWorkspaceResponse {
  id: string;
  filesDeleted: number;
}

export class PurgeWorkspaceCommand implements Command<Props, PurgeWorkspaceResponse> {
  constructor(
    private readonly purgeWorkspace: PurgeWorkspace,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<PurgeWorkspaceResponse> {
    // Ahead of its date only a system admin may: the owner's 30 days are a promise
    if (props.userId !== null && !props.isSystemAdmin) {
      throw new AccessDeniedError('Only system administrators can erase a workspace before its purge date');
    }

    const { workspace, filesDeleted } = await this.purgeWorkspace.execute({ workspaceId: props.workspaceId });

    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_PURGED,
      entityType: 'workspace',
      entityId: props.workspaceId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: {
        workspaceId: props.workspaceId,
        name: workspace.name,
        slug: workspace.slug,
        trigger: props.userId ? 'admin' : 'scheduled',
        filesDeleted,
        ...(props.stats ?? {}),
      },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.WARNING,
      source: props.userId ? 'ui' : 'system',
    });

    return { id: props.workspaceId, filesDeleted };
  }
}
