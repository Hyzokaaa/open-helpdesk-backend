import { Command } from '../../../shared/domain/command';
import { ChangeWorkspaceMemberRole } from '../../domain/services/workspace-change-member-role';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  workspaceId: string;
  targetUserId: string;
  newRole: WorkspaceRole;
  requestingUserId: string;
  isSystemAdmin: boolean;
  targetLabel: string;
  /** The role before the change, read by the caller. */
  previousRole?: WorkspaceRole;
}

export interface ChangeMemberRoleResponse {
  userId: string;
  role: WorkspaceRole;
}

export class ChangeMemberRoleCommand implements Command<Props, ChangeMemberRoleResponse> {
  constructor(
    private readonly changeRole: ChangeWorkspaceMemberRole,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<ChangeMemberRoleResponse> {
    const member = await this.changeRole.execute(props);

    await this.createAuditLog.execute({
      action: AuditAction.MEMBER_ROLE_CHANGED,
      entityType: 'workspace-member',
      entityId: props.targetUserId,
      userId: props.requestingUserId,
      workspaceId: props.workspaceId,
      metadata: {
        target: props.targetLabel,
        ...(props.previousRole ? { before: { role: props.previousRole } } : {}),
        after: { role: props.newRole },
      },
      category: AuditCategory.WORKSPACE,
      // Gaining or losing admin is what matters most in a role change
      level: props.previousRole === WorkspaceRole.ADMIN || props.newRole === WorkspaceRole.ADMIN
        ? AuditLevel.WARNING
        : AuditLevel.INFO,
      source: 'ui',
    });

    return { userId: member.userId, role: member.role };
  }
}
