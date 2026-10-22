import { Command } from '../../../shared/domain/command';
import { CreateDepartment } from '../../domain/services/department-create';
import { SetDepartmentMembers } from '../../domain/services/department-members-set';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  name: string;
  description: string | null;
  /** The agents it starts with; each is checked before the department is created. */
  memberUserIds?: string[];
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateDepartmentResponse {
  id: string;
  name: string;
  description: string | null;
  memberUserIds: string[];
}

export class CreateDepartmentCommand implements Command<Props, CreateDepartmentResponse> {
  constructor(
    private readonly createDepartment: CreateDepartment,
    private readonly ensurePermission: EnsureWorkspacePermission,
    private readonly setMembers?: SetDepartmentMembers,
  ) {}

  async execute(props: Props): Promise<CreateDepartmentResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.DEPARTMENT_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const memberUserIds = props.memberUserIds?.length && this.setMembers
      ? await this.setMembers.ensureEligible(props.workspaceId, props.memberUserIds)
      : [];

    const department = await this.createDepartment.execute({
      name: props.name,
      description: props.description,
      workspaceId: props.workspaceId,
    });
    if (memberUserIds.length && this.setMembers) {
      await this.setMembers.execute({ departmentId: department.getId(), workspaceId: props.workspaceId, userIds: memberUserIds });
    }

    return { id: department.getId(), name: department.name, description: department.description, memberUserIds };
  }
}
