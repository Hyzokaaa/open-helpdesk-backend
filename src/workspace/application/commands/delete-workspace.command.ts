import { Command } from '../../../shared/domain/command';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { DeleteWorkspace } from '../../domain/services/workspace-delete';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { WorkspaceLifecycleEvent } from '../../../email/domain/events';

interface Props {
  workspaceId: string;
  isSystemAdmin: boolean;
  userId: string;
  /** The workspace's name, typed to confirm. */
  confirmName: string;
  /** What the workspace held when it was deleted, for the record. */
  stats?: { memberCount: number; ticketCount: number };
}

export interface DeleteWorkspaceResponse {
  id: string;
  purgeAt: Date;
}

export class DeleteWorkspaceCommand implements Command<Props, DeleteWorkspaceResponse> {
  constructor(
    private readonly deleteWorkspace: DeleteWorkspace,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly eventPublisher?: EventPublisher,
  ) {}

  async execute(props: Props): Promise<DeleteWorkspaceResponse> {
    // Recorded only once it happened: a refused attempt must not read as a deletion
    const { workspace, purgeAt } = await this.deleteWorkspace.execute(props);

    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_DELETED,
      entityType: 'workspace',
      entityId: props.workspaceId,
      userId: props.userId,
      workspaceId: props.workspaceId,
      metadata: {
        workspaceId: props.workspaceId,
        name: workspace.name,
        slug: workspace.slug,
        purgeAt: purgeAt.toISOString(),
        ...(props.stats ?? {}),
      },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.WARNING,
      source: 'ui',
    });

    const event: WorkspaceLifecycleEvent = {
      workspaceId: props.workspaceId,
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      accountId: workspace.accountId,
      purgeAt: purgeAt.toISOString(),
      actorUserId: props.userId,
    };
    this.eventPublisher?.emit('workspace.deleted', event);

    return { id: props.workspaceId, purgeAt };
  }
}
