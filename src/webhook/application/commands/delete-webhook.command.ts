import { Command } from '../../../shared/domain/command';
import { DeleteWebhook } from '../../domain/services/webhook-delete';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export class DeleteWebhookCommand implements Command<Props, void> {
  constructor(
    private readonly deleteWebhook: DeleteWebhook,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<void> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    await this.deleteWebhook.execute({
      id: props.id,
      workspaceId: props.workspaceId,
    });
  }
}
