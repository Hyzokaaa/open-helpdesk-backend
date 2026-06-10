import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '../../../domain/entities/webhook';
import { WebhookRepository } from '../../../domain/repositories/webhook.repository';
import { WebhookModel } from '../models/webhook.model';

@Injectable()
export class TypeOrmWebhookRepository implements WebhookRepository {
  constructor(
    @InjectRepository(WebhookModel)
    private readonly repository: Repository<WebhookModel>,
  ) {}

  async create(webhook: Webhook): Promise<void> {
    await this.repository.save({
      id: webhook.getId(),
      workspaceId: webhook.workspaceId,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret,
      isActive: webhook.isActive,
    });
  }

  async findById(id: string): Promise<Webhook | null> {
    const model = await this.repository.findOneBy({ id });
    return model ? this.toDomain(model) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Webhook[]> {
    const models = await this.repository.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
    return models.map((m) => this.toDomain(m));
  }

  async findActiveByWorkspaceAndEvent(workspaceId: string, event: string): Promise<Webhook[]> {
    const models = await this.repository.find({
      where: { workspaceId, isActive: true },
    });
    // Filter by event in memory since events is stored as simple-array
    return models
      .filter((m) => m.events.includes(event))
      .map((m) => this.toDomain(m));
  }

  async update(webhook: Webhook): Promise<void> {
    await this.repository.update(webhook.getId(), {
      url: webhook.url,
      events: webhook.events,
      isActive: webhook.isActive,
    });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toDomain(model: WebhookModel): Webhook {
    return new Webhook({
      id: model.id,
      workspaceId: model.workspaceId,
      url: model.url,
      events: model.events,
      secret: model.secret,
      isActive: model.isActive,
      createdAt: model.createdAt,
    });
  }
}
