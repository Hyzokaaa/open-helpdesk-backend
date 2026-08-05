import { Command } from '../../../shared/domain/command';
import { AddWorkspaceMember } from '../../domain/services/workspace-add-member';
import { EnsureWorkspacePermission } from '../../domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../domain/permissions';
import { WorkspaceRole } from '../../domain/enums/workspace-role.enum';
import { CreateAuditLogEntry } from '../../../audit-log/domain/services/audit-log-create';
import { AuditAction } from '../../../audit-log/domain/enums/audit-action.enum';
import { AuditCategory } from '../../../audit-log/domain/enums/audit-category.enum';
import { AuditLevel } from '../../../audit-log/domain/enums/audit-level.enum';

interface Props {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  requestingUserId: string;
  isSystemAdmin: boolean;
  targetLabel: string;
}

export interface AddMemberResponse {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export class AddMemberCommand implements Command<Props, AddMemberResponse> {
  constructor(
    private readonly addMember: AddWorkspaceMember,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly createAuditLog: CreateAuditLogEntry,
  ) {}

  async execute(props: Props): Promise<AddMemberResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.requestingUserId,
      permission: PERMISSIONS.WORKSPACE_MEMBERS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const member = await this.addMember.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      role: props.role,
    });

    await this.createAuditLog.execute({
      action: AuditAction.MEMBER_ADDED,
      entityType: 'workspace-member',
      entityId: member.getId(),
      userId: props.requestingUserId,
      workspaceId: props.workspaceId,
      metadata: { target: props.targetLabel, role: props.role },
      category: AuditCategory.WORKSPACE,
      level: AuditLevel.INFO,
      source: 'ui',
    });

    return {
      id: member.getId(),
      workspaceId: member.workspaceId,
      userId: member.userId,
      role: member.role,
    };
  }
}
