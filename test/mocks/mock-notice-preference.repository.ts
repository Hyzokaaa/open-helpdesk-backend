import { NoticePreference } from '../../src/notification/domain/entities/notice-preference';
import { NoticePreferenceRepository } from '../../src/notification/domain/repositories/notice-preference.repository';

export class MockNoticePreferenceRepository implements NoticePreferenceRepository {
  readonly preferences: NoticePreference[] = [];

  async findByUserIds(userIds: string[]): Promise<NoticePreference[]> {
    return this.preferences.filter((p) => userIds.includes(p.userId));
  }

  async save(preference: NoticePreference): Promise<void> {
    const index = this.preferences.findIndex((p) => p.getId() === preference.getId());
    if (index >= 0) this.preferences[index] = preference;
    else this.preferences.push(preference);
  }
}
