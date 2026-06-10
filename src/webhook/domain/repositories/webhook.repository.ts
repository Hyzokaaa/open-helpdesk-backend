import { Webhook } from '../entities/webhook';

export interface WebhookRepository {
  create(webhook: Webhook): Promise<void>;
  findById(id: string): Promise<Webhook | null>;
  findByWorkspaceId(workspaceId: string): Promise<Webhook[]>;
  findActiveByWorkspaceAndEvent(workspaceId: string, event: string): Promise<Webhook[]>;
  update(webhook: Webhook): Promise<void>;
  delete(id: string): Promise<void>;
}
