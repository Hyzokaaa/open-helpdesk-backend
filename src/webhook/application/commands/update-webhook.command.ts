import { Command } from '../../../shared/domain/command';
import { UpdateWebhook } from '../../domain/services/webhook-update';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  id: string;
  workspaceId: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
  userId: string;
  isSystemAdmin: boolean;
}

export interface UpdateWebhookResponse {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
}

export class UpdateWebhookCommand implements Command<Props, UpdateWebhookResponse> {
  constructor(
    private readonly updateWebhook: UpdateWebhook,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<UpdateWebhookResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const webhook = await this.updateWebhook.execute({
      id: props.id,
      workspaceId: props.workspaceId,
      url: props.url,
      events: props.events,
      isActive: props.isActive,
    });

    return {
      id: webhook.getId(),
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
    };
  }
}
