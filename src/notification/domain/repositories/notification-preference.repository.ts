import { NotificationPreference } from '../entities/notification-preference';

export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreference | null>;
  findByUserIds(userIds: string[]): Promise<Map<string, NotificationPreference>>;
  upsert(preference: NotificationPreference): Promise<void>;
}
