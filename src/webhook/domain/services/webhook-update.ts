import { EntityNotFoundError } from '../../../shared/domain/errors';
import { Webhook } from '../entities/webhook';
import { WebhookRepository } from '../repositories/webhook.repository';

interface UpdateWebhookProps {
  id: string;
  workspaceId: string;
  url?: string;
  events?: string[];
  isActive?: boolean;
}

export class UpdateWebhook {
  constructor(
    private readonly repository: WebhookRepository,
    /** Refuses a URL the installation does not let workspaces call (its private network). */
    private readonly ensureReachable: (url: string) => Promise<void> = async () => undefined,
  ) {}

  async execute(props: UpdateWebhookProps): Promise<Webhook> {
    const webhook = await this.repository.findById(props.id);
    if (!webhook || webhook.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Webhook not found');
    }

    // Checked on every save, before changing anything, so an older webhook to a private address
    // cannot be kept or turned back on
    await this.ensureReachable(props.url ?? webhook.url);

    if (props.url !== undefined) webhook.url = props.url;
    if (props.events !== undefined) webhook.events = props.events;
    if (props.isActive !== undefined) webhook.isActive = props.isActive;

    await this.repository.update(webhook);
    return webhook;
  }
}
