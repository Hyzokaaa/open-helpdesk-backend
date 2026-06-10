import { Query } from '../../../shared/domain/query';
import { WebhookRepository } from '../../domain/repositories/webhook.repository';
import { EnsureWorkspacePermission } from '../../../workspace/domain/services/workspace-ensure-permission';
import { PERMISSIONS } from '../../../workspace/domain/permissions';

interface Props {
  workspaceId: string;
  userId: string;
  isSystemAdmin: boolean;
}

export interface WebhookListItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: Date | null;
}

export class ListWebhooksQuery implements Query<Props, WebhookListItem[]> {
  constructor(
    private readonly repository: WebhookRepository,
    private readonly ensurePermission: EnsureWorkspacePermission,
  ) {}

  async execute(props: Props): Promise<WebhookListItem[]> {
    await this.ensurePermission.execute({
      workspaceId: props.workspaceId,
      userId: props.userId,
      permission: PERMISSIONS.WORKSPACE_SETTINGS_MANAGE,
      isSystemAdmin: props.isSystemAdmin,
    });

    const webhooks = await this.repository.findByWorkspaceId(props.workspaceId);
    return webhooks.map((w) => ({
      id: w.getId(),
      url: w.url,
      events: w.events,
      isActive: w.isActive,
      createdAt: w.createdAt,
    }));
  }
}
