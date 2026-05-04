import { Command } from '../../../shared/domain/command';
import { DeleteCustomFieldDefinition } from '../../domain/services/custom-field-definition-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteCustomFieldDefinitionCommand implements Command<Props, void> {
  constructor(
    private readonly deleteDefinition: DeleteCustomFieldDefinition,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CUSTOM_FIELD_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.deleteDefinition.execute({ id: props.id });
  }
}
