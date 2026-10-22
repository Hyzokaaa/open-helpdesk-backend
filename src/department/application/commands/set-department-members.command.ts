import { Command } from '../../../shared/domain/command';
import { DepartmentMembersChange, SetDepartmentMembers } from '../../domain/services/department-members-set';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  departmentId: string;
  userIds: string[];
  workspaceId: string;
  currentUserId: string;
  isSystemAdmin: boolean;
}

export class SetDepartmentMembersCommand implements Command<Props, DepartmentMembersChange> {
  constructor(
    private readonly setMembers: SetDepartmentMembers,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<DepartmentMembersChange> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.currentUserId,
      permission: PERMISSIONS.DEPARTMENT_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    return this.setMembers.execute({
      departmentId: props.departmentId,
      workspaceId: props.workspaceId,
      userIds: props.userIds,
    });
  }
}
