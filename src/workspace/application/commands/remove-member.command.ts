import { Command } from '../../../shared/domain/command';
import { RemoveWorkspaceMember } from '../../domain/services/workspace-remove-member';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';
import { EventPublisher } from '../../../shared/domain/event-publisher';
import { WorkspaceMemberRemovedEvent } from '../../domain/workspace-member-events';

interface Props {
  workspaceId: string;
  userId: string;
  requestingUserId: string;
  isSystemAdmin: boolean;
  targetLabel: string;
}

export class RemoveMemberCommand implements Command<Props, void> {
  constructor(
    private readonly removeMember: RemoveWorkspaceMember,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly createAuditLog: CreateAuditLogEntry,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.removeMember.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
    });
    // What the person still had in the workspace goes with them (their portal links, for one)
    const removed: WorkspaceMemberRemovedEvent = { workspaceId: props.workspaceId, userId: props.userId };
    this.eventPublisher.emit('workspace.member.removed', removed);

    await this.createAuditLog.execute({
      action: AuditAction.MEMBER_REMOVED,
      entityType: 'workspace-member',
      entityId: props.userId,
      userId: props.requestingUserId,
      workspaceId: props.workspaceId,
      metadata: { target: props.targetLabel },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });
  }
}
