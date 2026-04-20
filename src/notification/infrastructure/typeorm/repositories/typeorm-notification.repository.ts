import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../../domain/entities/notification';
import { NotificationRepository } from '../../../domain/repositories/notification.repository';
import { NotificationModel } from '../models/notification.model';

@Injectable()
export class TypeOrmNotificationRepository implements NotificationRepository {
  constructor(
    @InjectRepository(NotificationModel)
    private readonly repository: Repository<NotificationModel>,
  ) {}

  async create(notification: Notification): Promise<void> {
    const model = this.toModel(notification);
    await this.repository.save(model);
  }

  async findByUserId(
    userId: string,
    unreadOnly: boolean,
  ): Promise<Notification[]> {
    const where: Record<string, unknown> = { userId };
    if (unreadOnly) where.isRead = false;

    const models = await this.repository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return models.map((m) => this.toDomain(m));
  }

  async countUnread(userId: string): Promise<number> {
    return this.repository.countBy({ userId, isRead: false });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.repository.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.repository.update({ userId, isRead: false }, { isRead: true });
  }

  private toDomain(model: NotificationModel): Notification {
    return new Notification({
      id: model.id,
      userId: model.userId,
      type: model.type,
      title: model.title,
      ticketId: model.ticketId,
      workspaceSlug: model.workspaceSlug,
      isRead: model.isRead,
      createdAt: model.createdAt,
    });
  }

  private toModel(notification: Notification): NotificationModel {
    const model = new NotificationModel();
    model.id = notification.getId();
    model.userId = notification.userId;
    model.type = notification.type;
    model.title = notification.title;
    model.ticketId = notification.ticketId;
    model.workspaceSlug = notification.workspaceSlug;
    model.isRead = notification.isRead;
    return model;
  }
}
