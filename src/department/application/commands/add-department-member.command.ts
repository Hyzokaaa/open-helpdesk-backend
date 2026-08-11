import { Command } from '../../../shared/domain/command';
import { AddDepartmentMember } from '../../domain/services/department-member-add';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  departmentId: string;
  userId: string;
  workspaceId: string;
  currentUserId: string;
  isSystemAdmin: boolean;
}

export interface AddDepartmentMemberResponse {
  id: string;
  departmentId: string;
  userId: string;
}

export class AddDepartmentMemberCommand implements Command<Props, AddDepartmentMemberResponse> {
  constructor(
    private readonly addMember: AddDepartmentMember,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<AddDepartmentMemberResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.currentUserId,
      permission: PERMISSIONS.DEPARTMENT_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const member = await this.addMember.execute({
      departmentId: props.departmentId,
      userId: props.userId,
    });

    return { id: member.getId(), departmentId: member.departmentId, userId: member.userId };
  }
}
