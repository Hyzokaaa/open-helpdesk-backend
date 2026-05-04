import { Command } from '../../../shared/domain/command';
import { ReorderCustomFieldDefinitions } from '../../domain/services/custom-field-definition-reorder';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  items: { id: string; position: number }[];
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class ReorderCustomFieldDefinitionsCommand implements Command<Props, void> {
  constructor(
    private readonly reorder: ReorderCustomFieldDefinitions,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.CUSTOM_FIELD_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.reorder.execute(props.items);
  }
}
