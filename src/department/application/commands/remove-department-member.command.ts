import { Command } from '../../../shared/domain/command';
import { RemoveDepartmentMember } from '../../domain/services/department-member-remove';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  departmentId: string;
  userId: string;
  workspaceId: string;
  currentUserId: string;
  isSystemAdmin: boolean;
}

export class RemoveDepartmentMemberCommand implements Command<Props, void> {
  constructor(
    private readonly removeMember: RemoveDepartmentMember,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.currentUserId,
      permission: PERMISSIONS.DEPARTMENT_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.removeMember.execute({
      departmentId: props.departmentId,
      userId: props.userId,
    });
  }
}
