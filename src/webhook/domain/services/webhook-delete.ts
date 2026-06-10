import { EntityNotFoundError } from '../../../shared/domain/errors';
import { WebhookRepository } from '../repositories/webhook.repository';

interface DeleteWebhookProps {
  id: string;
  workspaceId: string;
}

export class DeleteWebhook {
  constructor(
    private readonly repository: WebhookRepository,
  ) {}

  async execute(props: DeleteWebhookProps): Promise<void> {
    const webhook = await this.repository.findById(props.id);
    if (!webhook || webhook.workspaceId !== props.workspaceId) {
      throw new EntityNotFoundError('Webhook not found');
    }
    await this.repository.delete(props.id);
  }
}
