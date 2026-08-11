import { Command } from '../../../shared/domain/command';
import { UpdateDepartment } from '../../domain/services/department-update';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  name?: string;
  description?: string | null;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface UpdateDepartmentResponse {
  id: string;
  name: string;
  description: string | null;
}

export class UpdateDepartmentCommand implements Command<Props, UpdateDepartmentResponse> {
  constructor(
    private readonly updateDepartment: UpdateDepartment,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<UpdateDepartmentResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.DEPARTMENT_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const department = await this.updateDepartment.execute({
      id: props.id,
      name: props.name,
      description: props.description,
    });

    return { id: department.getId(), name: department.name, description: department.description };
  }
}
