import { Command } from '../../../shared/domain/command';
import { CreateDepartment } from '../../domain/services/department-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  name: string;
  description: string | null;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateDepartmentResponse {
  id: string;
  name: string;
  description: string | null;
}

export class CreateDepartmentCommand implements Command<Props, CreateDepartmentResponse> {
  constructor(
    private readonly createDepartment: CreateDepartment,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateDepartmentResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.DEPARTMENT_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const department = await this.createDepartment.execute({
      name: props.name,
      description: props.description,
      workspaceId: props.workspaceId,
    });

    return { id: department.getId(), name: department.name, description: department.description };
  }
}
