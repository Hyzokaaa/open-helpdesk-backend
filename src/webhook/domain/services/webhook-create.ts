import { randomBytes } from 'crypto';
import { IdGenerator } from '../../../shared/domain/id-generator';
import { Webhook } from '../entities/webhook';
import { WebhookRepository } from '../repositories/webhook.repository';

interface CreateWebhookProps {
  workspaceId: string;
  url: string;
  events: string[];
  secret?: string;
}

export class CreateWebhook {
  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly repository: WebhookRepository,
  ) {}

  async execute(props: CreateWebhookProps): Promise<Webhook> {
    const secret = props.secret || randomBytes(32).toString('hex');

    const webhook = new Webhook({
      id: this.idGenerator.create(),
      workspaceId: props.workspaceId,
      url: props.url,
      events: props.events,
      secret,
      isActive: true,
      createdAt: null,
    });

    await this.repository.create(webhook);
    return webhook;
  }
}
