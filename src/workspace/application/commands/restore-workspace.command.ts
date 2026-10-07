import { Command } from '../../../shared/domain/command';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { RestoreWorkspace } from '../../domain/services/workspace-restore';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { WorkspaceLifecycleEvent } from '../../../email/domain/events';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface RestoreWorkspaceResponse {
  id: string;
  name: string;
  slug: string;
}

export class RestoreWorkspaceCommand implements Command<Props, RestoreWorkspaceResponse> {
  constructor(
    private readonly restoreWorkspace: RestoreWorkspace,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly eventPublisher?: EventPublisher,
  ) {}

  async execute(props: Props): Promise<RestoreWorkspaceResponse> {
    const workspace = await this.restoreWorkspace.execute(props);

    await this.createAuditLog.execute({
      action: AuditAction.WORKSPACE_RESTORED,
      entityType: 'workspace',
      entityId: workspace.getId(),
      userId: props.userId,
      workspaceId: workspace.getId(),
      metadata: { name: workspace.name, slug: workspace.slug },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    const event: WorkspaceLifecycleEvent = {
      workspaceId: workspace.getId(),
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      accountId: workspace.accountId,
      purgeAt: null,
      actorUserId: props.userId,
    };
    this.eventPublisher?.emit('workspace.restored', event);

    return { id: workspace.getId(), name: workspace.name, slug: workspace.slug };
  }
}
