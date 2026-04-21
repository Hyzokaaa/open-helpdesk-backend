import { NotificationPreference } from '../../src/notification/domain/entities/notification-preference';
import { NotificationPreferenceRepository } from '../../src/notification/domain/repositories/notification-preference.repository';

export class MockNotificationPreferenceRepository implements NotificationPreferenceRepository {
  private preferences: NotificationPreference[] = [];

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    return this.preferences.find((p) => p.userId === userId) ?? null;
  }

  async findByUserIds(userIds: string[]): Promise<Map<string, NotificationPreference>> {
    const map = new Map<string, NotificationPreference>();
    for (const pref of this.preferences) {
      if (userIds.includes(pref.userId)) map.set(pref.userId, pref);
    }
    return map;
  }

  async upsert(preference: NotificationPreference): Promise<void> {
    const index = this.preferences.findIndex((p) => p.userId === preference.userId);
    if (index >= 0) this.preferences[index] = preference;
    else this.preferences.push(preference);
  }

  seed(preference: NotificationPreference): void {
    this.preferences.push(preference);
  }
}
