import { Command } from '../../../shared/domain/command';
import { DeleteDepartment } from '../../domain/services/department-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteDepartmentCommand implements Command<Props, void> {
  constructor(
    private readonly deleteDepartment: DeleteDepartment,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.DEPARTMENT_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.deleteDepartment.execute({ id: props.id });
  }
}
