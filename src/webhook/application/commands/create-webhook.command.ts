import { Command } from '../../../shared/domain/command';
import { CreateWebhook } from '../../domain/services/webhook-create';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  url: string;
  events: string[];
  secret?: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface CreateWebhookResponse {
  id: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date | null;
}

export class CreateWebhookCommand implements Command<Props, CreateWebhookResponse> {
  constructor(
    private readonly createWebhook: CreateWebhook,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<CreateWebhookResponse> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const webhook = await this.createWebhook.execute({
      workspaceId: props.workspaceId,
      url: props.url,
      events: props.events,
      secret: props.secret,
    });

    return {
      id: webhook.getId(),
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
    };
  }
}
