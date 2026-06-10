import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import { TypeOrmWebhookRepository } from '../../typeorm/repositories/typeorm-webhook.repository';

interface BaseEvent {
  workspaceId: string;
  [key: string]: unknown;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly webhookRepository: TypeOrmWebhookRepository,
  ) {}

  @OnEvent('ticket.created')
  async onTicketCreated(event: BaseEvent): Promise<void> {
    await this.deliver('ticket.created', event);
  }

  @OnEvent('ticket.statusChanged')
  async onTicketStatusChanged(event: BaseEvent): Promise<void> {
    await this.deliver('ticket.statusChanged', event);
  }

  @OnEvent('ticket.assigned')
  async onTicketAssigned(event: BaseEvent): Promise<void> {
    await this.deliver('ticket.assigned', event);
  }

  @OnEvent('comment.created')
  async onCommentCreated(event: BaseEvent): Promise<void> {
    await this.deliver('comment.created', event);
  }

  private async deliver(eventType: string, data: BaseEvent): Promise<void> {
    try {
      const webhooks = await this.webhookRepository.findActiveByWorkspaceAndEvent(
        data.workspaceId,
        eventType,
      );

      for (const webhook of webhooks) {
        this.sendWebhook(webhook.url, webhook.secret, eventType, data).catch((err) => {
          this.logger.warn(`Webhook delivery failed for ${webhook.getId()} to ${webhook.url}: ${err.message}`);
        });
      }
    } catch (err) {
      this.logger.error(`Failed to process webhooks for event ${eventType}`, (err as Error).stack);
    }
  }

  private async sendWebhook(
    url: string,
    secret: string,
    eventType: string,
    data: unknown,
  ): Promise<void> {
    const body = JSON.stringify({ event: eventType, data, timestamp: new Date().toISOString() });
    const signature = createHmac('sha256', secret).update(body).digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
        },
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`Webhook ${url} returned status ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
