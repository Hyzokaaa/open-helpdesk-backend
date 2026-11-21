import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHmac } from 'crypto';
import { TypeOrmWebhookRepository } from '../../typeorm/repositories/typeorm-webhook.repository';
import { webhookUrlHost } from '../../../domain/webhook-url-host';
import { privateNetworkUrlsAllowed } from '../../../../shared/infrastructure/private-network';
import { publicHttpRequest } from '../../../../shared/infrastructure/public-http-request';

interface BaseEvent {
  workspaceId: string;
  [key: string]: unknown;
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  /** The request used when the installation keeps webhooks off its private network. */
  private readonly publicRequest = publicHttpRequest;

  constructor(
    private readonly webhookRepository: TypeOrmWebhookRepository,
  ) {}

  @OnEvent('ticket.created')
  async onTicketCreated(event: BaseEvent): Promise<void> {
    await this.deliver('ticket.created', event);
  }

  @OnEvent('ticket.statusChanged')
  async onTicketStatusChanged(event: BaseEvent & { quiet?: boolean; assigneeChange?: unknown }): Promise<void> {
    // quiet and assigneeChange only steer our own notifications; they are not part of the webhook payload
    const { quiet: _quiet, assigneeChange: _assigneeChange, ...data } = event;
    await this.deliver('ticket.statusChanged', data);
  }

  @OnEvent('ticket.reopened')
  async onTicketReopened(event: BaseEvent): Promise<void> {
    await this.deliver('ticket.reopened', event);
  }

  @OnEvent('ticket.assigned')
  async onTicketAssigned(event: BaseEvent & { statusChange?: unknown; followsStatusChange?: boolean }): Promise<void> {
    // Both only steer our own notifications; they are not part of the webhook payload
    const { statusChange: _statusChange, followsStatusChange: _follows, ...data } = event;
    await this.deliver('ticket.assigned', data);
  }

  @OnEvent('ticket.updated')
  async onTicketUpdated(event: BaseEvent): Promise<void> {
    await this.deliver('ticket.updated', event);
  }

  @OnEvent('ticket.deleted')
  async onTicketDeleted(event: BaseEvent): Promise<void> {
    await this.deliver('ticket.deleted', event);
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
          // Only the host: some URLs carry their secret in the path (Slack, Discord)
          this.logger.warn(`Webhook delivery failed for ${webhook.getId()} to ${webhookUrlHost(webhook.url)}: ${err.message}`);
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

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Event': eventType,
    };

    // Hosted: the address is checked when connecting, so a name cannot point inside after it was
    // saved, and redirects are not followed, since one could lead into the private network
    if (!privateNetworkUrlsAllowed()) {
      const response = await this.publicRequest(url, { method: 'POST', headers, body, timeoutMs: 10000, maxBytes: 64 * 1024 });
      if (response.status >= 300 && response.status < 400) {
        this.logger.warn(`Webhook to ${webhookUrlHost(url)} answered with a redirect, which is not followed`);
      } else if (response.status < 200 || response.status >= 300) {
        this.logger.warn(`Webhook to ${webhookUrlHost(url)} returned status ${response.status}`);
      }
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`Webhook to ${webhookUrlHost(url)} returned status ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
