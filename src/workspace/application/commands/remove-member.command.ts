import { Command } from '../../../shared/domain/command';
import { RemoveWorkspaceMember } from '../../domain/services/workspace-remove-member';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';

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

    await this.createAuditLog.execute({
      action: AuditAction.MEMBER_REMOVED,
      entityType: 'workspace-member',
      entityId: props.userId,
      userId: props.requestingUserId,
      workspaceId: props.workspaceId,
      metadata: { target: props.targetLabel },
    });
  }
}
