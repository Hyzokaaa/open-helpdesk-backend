import { Notification } from '../entities/notification';

export interface NotificationRepository {
  create(notification: Notification): Promise<void>;
  findByUserId(userId: string, unreadOnly: boolean): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
}
