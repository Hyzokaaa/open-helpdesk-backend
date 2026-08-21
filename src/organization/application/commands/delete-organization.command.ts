import { Command } from '../../../shared/domain/command';
import { DeleteOrganization } from '../../domain/services/organization-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteOrganizationCommand implements Command<Props, void> {
  constructor(
    private readonly deleteOrganization: DeleteOrganization,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.ORGANIZATION_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.deleteOrganization.execute({ id: props.id });
  }
}
